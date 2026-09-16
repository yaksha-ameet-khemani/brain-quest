import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { ownedChild } from "@/lib/childOwnership";
import type { ChildRow } from "@/lib/types";

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
}

// The detailed, everything-included answer log for one child - what they
// were asked, what they picked, whether it was right, how long it took.
// Parent/admin only; unlike anything the kid-facing routes ever return,
// correct_index and selected_index are both included on purpose here.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
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

  const rows = await query<LogRow>(
    `SELECT
       r.id AS round_id, rq.position, rq.category, rq.question_text, rq.options,
       rq.correct_index, rq.selected_index, rq.is_correct, rq.shown_at, rq.answered_at,
       rq.points_awarded,
       EXTRACT(EPOCH FROM (rq.answered_at - rq.shown_at)) AS duration_seconds
     FROM round_questions rq
     JOIN rounds r ON r.id = rq.round_id
     WHERE r.child_id = $1 AND rq.answered_at IS NOT NULL
     ORDER BY rq.answered_at DESC
     LIMIT 300`,
    [childId]
  );

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
  }));

  return NextResponse.json({ child, log });
}
