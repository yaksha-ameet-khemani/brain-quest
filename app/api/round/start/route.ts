import { NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { buildRoundQuestions, buildReviewQuestions, buildCheckupQuestions } from "@/lib/buildRound";
import { sanitizeQuestion } from "@/lib/sanitizeQuestion";
import { todayRangeUtc } from "@/lib/timezone";
import { getLevelProgress } from "@/lib/levelProgress";
import { getReviewProgress } from "@/lib/reviewProgress";
import { getCheckupProgress } from "@/lib/checkupProgress";
import { BONUS_ROUNDS_PER_DAY, LEVELS, MAX_ROUNDS_PER_DAY, QUESTIONS_PER_ROUND, type Level } from "@/lib/config";
import type { ChildRow, RoundQuestionRow, RoundRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const child = await queryOne<Pick<ChildRow, "id" | "level">>(
    "SELECT id, level FROM children WHERE id = $1",
    [kid.childId]
  );
  if (!child) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const baseLevel = child.level;

  // Resume an existing in-progress round rather than starting a new one -
  // so closing the browser mid-quiz doesn't lose progress or burn a daily slot.
  const existingRound = await queryOne<Pick<RoundRow, "id" | "level" | "kind">>(
    `SELECT id, level, kind FROM rounds WHERE child_id = $1 AND status = 'in_progress'
     ORDER BY started_at DESC LIMIT 1`,
    [kid.childId]
  );

  if (existingRound) {
    const payload = await loadRoundForResume(existingRound.id);
    if (payload) return NextResponse.json(payload);
    // Fell through: the in-progress round had no unanswered question left
    // (shouldn't normally happen - answer route completes it) - mark it
    // abandoned so the child isn't stuck, then fall through to a fresh round.
    await queryOne("UPDATE rounds SET status = 'abandoned' WHERE id = $1", [existingRound.id]);
  }

  const body = await req.json().catch(() => null);
  const requestedLevel: number | undefined = body?.level;
  const mode: string | undefined = body?.mode;

  if (mode === "review") {
    const reviewProgress = await getReviewProgress(kid.childId);
    if (!reviewProgress.reviewAvailableToday) {
      return NextResponse.json(
        {
          error:
            reviewProgress.wrongQuestionCount === 0
              ? "Nothing to review right now - no recent wrong answers!"
              : "You've used today's review round. Come back tomorrow!",
        },
        { status: 403 }
      );
    }

    const drafts = await buildReviewQuestions(kid.childId);
    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "Nothing to review right now - no recent wrong answers!" },
        { status: 403 }
      );
    }

    return createRound(kid.childId, baseLevel, "review", drafts);
  }

  // Before any fresh standard round: if this child has recent wrong
  // answers to recheck and hasn't done today's checkup yet, serve that
  // instead - regardless of what level/mode was requested. See
  // lib/checkupProgress.ts and lib/buildRound.ts's buildCheckupQuestions().
  const checkupProgress = await getCheckupProgress(kid.childId);
  if (checkupProgress.checkupAvailableToday) {
    const checkupDrafts = await buildCheckupQuestions(kid.childId);
    if (checkupDrafts.length > 0) {
      return createRound(kid.childId, baseLevel, "checkup", checkupDrafts);
    }
  }

  // Which level to actually play: a kid's own base level by default, or -
  // if they've earned it today - the bonus level one up from that. See
  // lib/levelProgress.ts for the unlock rule.
  let level: Level = baseLevel;
  if (requestedLevel !== undefined && requestedLevel !== baseLevel) {
    const progress = await getLevelProgress(kid.childId, baseLevel);
    if (requestedLevel !== progress.bonusLevel || !progress.bonusUnlockedToday) {
      return NextResponse.json(
        { error: "That level isn't unlocked for you today yet." },
        { status: 403 }
      );
    }
    if (progress.bonusRoundsRemaining <= 0) {
      return NextResponse.json(
        { error: "You've used all your bonus rounds for today. Come back tomorrow!" },
        { status: 403 }
      );
    }
    level = requestedLevel as Level;
  }

  const { start, end } = todayRangeUtc();
  const dailyCap = level === baseLevel ? MAX_ROUNDS_PER_DAY : BONUS_ROUNDS_PER_DAY;
  const countRow = await queryOne<{ count: string }>(
    "SELECT count(*) FROM rounds WHERE child_id = $1 AND level = $2 AND kind = 'standard' AND started_at >= $3 AND started_at < $4",
    [kid.childId, level, start.toISOString(), end.toISOString()]
  );
  if (Number(countRow?.count ?? 0) >= dailyCap) {
    return NextResponse.json(
      { error: "You've played all your rounds for today. Come back tomorrow!" },
      { status: 403 }
    );
  }

  const drafts = await buildRoundQuestions(level, kid.childId);
  return createRound(kid.childId, level, "standard", drafts);
}

async function createRound(
  childId: string,
  level: Level,
  kind: "standard" | "review" | "checkup",
  drafts: Awaited<ReturnType<typeof buildRoundQuestions>>
) {
  const created = await withTransaction(async (tx) => {
    const roundResult = await tx.query(
      "INSERT INTO rounds (child_id, level, kind) VALUES ($1, $2, $3) RETURNING id",
      [childId, level, kind]
    );
    const roundId = roundResult.rows[0].id as string;

    let firstRow: { category: string; question_text: string; options: string[]; shown_at: string } | null = null;
    for (let position = 0; position < drafts.length; position++) {
      const d = drafts[position]!;
      const shownAt = position === 0 ? new Date().toISOString() : null;
      const inserted = await tx.query(
        `INSERT INTO round_questions
           (round_id, position, source, question_id, template_key, category, question_text, options, correct_index, explanation, shown_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING category, question_text, options, shown_at`,
        [
          roundId,
          position,
          d.source,
          d.questionId,
          d.templateKey,
          d.category,
          d.questionText,
          JSON.stringify(d.options),
          d.correctIndex,
          d.explanation,
          shownAt,
        ]
      );
      if (position === 0) firstRow = inserted.rows[0];
    }
    return { roundId, firstRow };
  });

  if (!created.firstRow) {
    return NextResponse.json({ error: "Could not build round questions." }, { status: 500 });
  }

  return NextResponse.json({
    roundId: created.roundId,
    level,
    kind,
    totalQuestions: drafts.length,
    timeLimitSeconds: LEVELS[level].perQuestionSeconds,
    question: sanitizeQuestion({
      position: 0,
      category: created.firstRow.category,
      question_text: created.firstRow.question_text,
      options: created.firstRow.options,
      shown_at: created.firstRow.shown_at,
    }),
  });
}

async function loadRoundForResume(roundId: string) {
  const round = await queryOne<Pick<RoundRow, "id" | "level" | "kind">>(
    "SELECT id, level, kind FROM rounds WHERE id = $1",
    [roundId]
  );
  if (!round) return null;

  const totalRow = await queryOne<{ count: string }>(
    "SELECT count(*) FROM round_questions WHERE round_id = $1",
    [roundId]
  );
  const totalQuestions = Number(totalRow?.count ?? QUESTIONS_PER_ROUND);

  const nextQ = await queryOne<
    Pick<RoundQuestionRow, "position" | "category" | "question_text" | "options" | "shown_at">
  >(
    `SELECT position, category, question_text, options, shown_at FROM round_questions
     WHERE round_id = $1 AND answered_at IS NULL
     ORDER BY position ASC LIMIT 1`,
    [roundId]
  );
  if (!nextQ) return null;

  // Always refresh shown_at to right now, not just when it was never set.
  // shown_at means "when did the browser actually last see this question" -
  // if we only set it once, resuming a round after any gap (walked away,
  // closed the tab, tested the app across sessions) hands the kid a question
  // whose timer already expired before they ever saw it this time, so their
  // very first answer instantly "times out" regardless of correctness. A kid
  // reloading the page to buy more thinking time is a fine trade-off against
  // that.
  const shownAt = new Date().toISOString();
  await queryOne("UPDATE round_questions SET shown_at = $1 WHERE round_id = $2 AND position = $3", [
    shownAt,
    roundId,
    nextQ.position,
  ]);

  const level = round.level as Level;
  return {
    roundId: round.id,
    level,
    kind: round.kind,
    totalQuestions,
    timeLimitSeconds: LEVELS[level].perQuestionSeconds,
    question: sanitizeQuestion({
      position: nextQ.position,
      category: nextQ.category,
      question_text: nextQ.question_text,
      options: nextQ.options,
      shown_at: shownAt,
    }),
  };
}
