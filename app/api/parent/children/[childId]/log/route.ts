import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { ownedChild } from "@/lib/childOwnership";
import type { ChildRow } from "@/lib/types";
import { TZ, localDateKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

interface LogRow {
  round_id: string;
  position: number;
  category: string;
  question_text: string;
  options: string[];
  correct_index: number;
  selected_index: number | null;
  is_correct: boolean | null;
  shown_at: string | null;
  answered_at: string | null;
  points_awarded: number;
  duration_seconds: string | null;
  kind: string;
  paused: boolean;
  pen_paper: boolean;
}

const LOG_LIMIT = 500;
const CATEGORIES = ["math", "logic", "riddle", "spatial"];
const KINDS = ["standard", "review", "checkup"];
const RESULTS = ["correct", "wrong", "timeout"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The detailed, everything-included answer log for one child - what they
// were asked, what they picked, whether it was right, how long it took.
// Parent/admin only; unlike anything the kid-facing routes ever return,
// correct_index and selected_index are both included on purpose here.
//
// Optional filters (query string): from / to (inclusive "YYYY-MM-DD" days in
// APP_TIMEZONE), category, kind (round type), result (correct | wrong |
// timeout), q (text search). All applied in SQL, so they reach past the
// newest-LOG_LIMIT cut-off. `summary` counts every answer matching the
// filters except `result`, so the result chips can show their own counts.
export async function GET(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  if (!(await ownedChild(childId, parent))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const childRow = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "photo_data_url" | "level">>(
    "SELECT id, name, avatar, photo_data_url, level FROM children WHERE id = $1",
    [childId]
  );
  if (!childRow) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const child = {
    id: childRow.id,
    name: childRow.name,
    avatar: childRow.avatar,
    photoDataUrl: childRow.photo_data_url,
    level: childRow.level,
  };

  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const category = sp.get("category") ?? "";
  const kind = sp.get("kind") ?? "";
  const result = sp.get("result") ?? "";
  const search = (sp.get("q") ?? "").trim().slice(0, 100);
  if ((from && !DAY_RE.test(from)) || (to && !DAY_RE.test(to))) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD." }, { status: 400 });
  }
  if ((category && !CATEGORIES.includes(category)) || (kind && !KINDS.includes(kind)) || (result && !RESULTS.includes(result))) {
    return NextResponse.json({ error: "Unknown filter." }, { status: 400 });
  }

  const args: unknown[] = [childId];
  const where = ["r.child_id = $1", "r.kind <> 'practice'", "rq.answered_at IS NOT NULL"];
  // Postgres refuses a parameter no clause uses, so the timezone is only
  // passed when a date filter needs it.
  let localDay = "";
  if (from || to) {
    args.push(TZ);
    localDay = `to_char(rq.answered_at AT TIME ZONE $${args.length}, 'YYYY-MM-DD')`;
  }
  if (from) {
    args.push(from);
    where.push(`${localDay} >= $${args.length}`);
  }
  if (to) {
    args.push(to);
    where.push(`${localDay} <= $${args.length}`);
  }
  if (category) {
    args.push(category);
    where.push(`rq.category = $${args.length}`);
  }
  if (kind) {
    args.push(kind);
    where.push(`r.kind = $${args.length}`);
  }
  if (search) {
    args.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(rq.question_text ILIKE $${args.length} OR rq.options::text ILIKE $${args.length})`);
  }
  const resultWhere =
    result === "correct"
      ? " AND rq.is_correct = true"
      : result === "wrong"
        ? " AND rq.is_correct = false"
        : result === "timeout"
          ? " AND rq.is_correct = false AND rq.selected_index = -1"
          : "";
  const baseSql = `FROM round_questions rq JOIN rounds r ON r.id = rq.round_id WHERE ${where.join(" AND ")}`;

  const [rows, summaryRow] = await Promise.all([
    query<LogRow>(
      `SELECT
         r.id AS round_id, rq.position, rq.category, rq.question_text, rq.options,
         rq.correct_index, rq.selected_index, rq.is_correct, rq.shown_at, rq.answered_at,
         rq.points_awarded, r.kind, rq.paused, rq.pen_paper,
         EXTRACT(EPOCH FROM (rq.answered_at - rq.shown_at)) AS duration_seconds
       ${baseSql}${resultWhere}
       ORDER BY rq.answered_at DESC
       LIMIT ${LOG_LIMIT}`,
      args
    ),
    queryOne<{ total: string; correct: string; wrong: string; timeout: string; seconds: string | null }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE rq.is_correct = true) AS correct,
              count(*) FILTER (WHERE rq.is_correct = false) AS wrong,
              count(*) FILTER (WHERE rq.is_correct = false AND rq.selected_index = -1) AS timeout,
              sum(EXTRACT(EPOCH FROM (rq.answered_at - rq.shown_at))) AS seconds
       ${baseSql}`,
      args
    ),
  ]);

  const summary = {
    total: Number(summaryRow?.total ?? 0),
    correct: Number(summaryRow?.correct ?? 0),
    wrong: Number(summaryRow?.wrong ?? 0),
    timeout: Number(summaryRow?.timeout ?? 0),
    totalSeconds: Math.round(Number(summaryRow?.seconds ?? 0)),
  };

  const log = rows.map((r) => ({
    roundId: r.round_id,
    position: r.position,
    category: r.category,
    questionText: r.question_text,
    options: r.options,
    correctIndex: r.correct_index,
    selectedIndex: r.selected_index,
    isCorrect: r.is_correct,
    shownAt: r.shown_at,
    answeredAt: r.answered_at,
    pointsAwarded: r.points_awarded,
    durationSeconds: r.duration_seconds === null ? null : Math.round(Number(r.duration_seconds)),
    kind: r.kind,
    paused: r.paused,
    penPaper: r.pen_paper,
  }));

  return NextResponse.json({ child, log, summary, limit: LOG_LIMIT, today: localDateKey() });
}
