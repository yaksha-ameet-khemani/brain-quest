import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";
import { getNegativeMarkingEnabled } from "@/lib/gameSettings";
import {
  PERFECT_ROUND_BONUS,
  POINTS_PER_CORRECT,
  SPEED_BONUS_FRACTION_OF_TIME,
  SPEED_BONUS_POINTS,
  STREAK_MULTIPLIER,
  STREAK_THRESHOLD,
  effectiveAnswerSeconds,
  type Level,
} from "@/lib/config";
import type { ChildRow, RoundQuestionRow, RoundRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Small grace window added on top of the real per-question time limit to
// absorb normal network latency between "question shown" and "answer
// received" - not something a kid can use to stall, just enough to not
// punish a slightly slow connection.
const TIMEOUT_GRACE_SECONDS = 4;

// Half of a level's base points, docked for a wrong answer when the admin's
// negative-marking toggle is on (see lib/gameSettings.ts). Kept to the base
// only, never the streak/speed bonuses - those are contingent extras, not a
// baseline "what this question was worth". Deliberately silent: nothing in
// this route's response, and nothing in app/quiz/page.tsx, ever tells the
// kid a penalty happened - they only ever see "Not quite".
function wrongAnswerPenalty(level: Level): number {
  return Math.round(POINTS_PER_CORRECT[level] / 2);
}

export async function POST(req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const position: number | undefined = body?.position;
  const selectedIndex: number | undefined = body?.selectedIndex;
  // The kid hit "Pause timer" on this question before answering - see
  // app/quiz/page.tsx. Trades away scoring for unlimited thinking time: the
  // time limit stops applying at all (not just extends), and even a correct
  // answer earns no points, so it also can't be used to farm streak or
  // perfect-round bonuses.
  const paused: boolean = body?.paused === true;
  if (typeof position !== "number" || typeof selectedIndex !== "number") {
    return NextResponse.json({ error: "position and selectedIndex are required." }, { status: 400 });
  }

  const round = await queryOne<
    Pick<RoundRow, "id" | "child_id" | "level" | "kind" | "status" | "correct_count" | "points_awarded">
  >(
    "SELECT id, child_id, level, kind, status, correct_count, points_awarded FROM rounds WHERE id = $1",
    [roundId]
  );
  if (!round || round.child_id !== kid.childId) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }
  if (round.status !== "in_progress") {
    return NextResponse.json({ error: "This round is already finished." }, { status: 409 });
  }

  const rq = await queryOne<
    Pick<RoundQuestionRow, "position" | "correct_index" | "explanation" | "shown_at" | "answered_at" | "category">
  >(
    "SELECT position, correct_index, explanation, shown_at, answered_at, category FROM round_questions WHERE round_id = $1 AND position = $2",
    [roundId, position]
  );
  if (!rq) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (rq.answered_at) return NextResponse.json({ error: "Already answered." }, { status: 409 });
  if (!rq.shown_at) return NextResponse.json({ error: "Question was never served." }, { status: 409 });

  const child = await queryOne<Pick<ChildRow, "answer_seconds">>(
    "SELECT answer_seconds FROM children WHERE id = $1",
    [kid.childId]
  );

  const level = round.level as Level;
  const timeLimitSeconds = effectiveAnswerSeconds(level, child?.answer_seconds ?? null);
  const elapsedSeconds = (Date.now() - new Date(rq.shown_at).getTime()) / 1000;
  const withinTime = elapsedSeconds <= timeLimitSeconds + TIMEOUT_GRACE_SECONDS;

  const rawCorrect = selectedIndex === rq.correct_index;
  const isCorrect = paused ? rawCorrect : rawCorrect && withinTime;
  const isReview = round.kind === "review";

  const totalQuestionsRow = await queryOne<{ count: string }>(
    "SELECT count(*) FROM round_questions WHERE round_id = $1",
    [roundId]
  );
  const totalQuestions = Number(totalQuestionsRow?.count ?? position + 1);

  // Current streak: consecutive correct answers ending at this one, looking
  // back over already-answered questions in this round. Review rounds are
  // practice only - never scored, so skip all of this (see lib/config.ts).
  // A paused question never earns points either.
  let pointsAwarded = 0;
  let streak = 0;
  if (isCorrect && !isReview && !paused) {
    const priorAnswers = await query<Pick<RoundQuestionRow, "position" | "is_correct" | "paused">>(
      "SELECT position, is_correct, paused FROM round_questions WHERE round_id = $1 AND position < $2 ORDER BY position DESC",
      [roundId, position]
    );

    streak = 1;
    for (const prior of priorAnswers) {
      // A paused answer never scored, so it can't extend a streak either -
      // otherwise pausing a hard question would be a free way to keep a
      // streak (and its bonus) alive.
      if (prior.is_correct && !prior.paused) streak++;
      else break;
    }

    const base = POINTS_PER_CORRECT[level];
    const multiplier = streak >= STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1;
    const speedBonus =
      elapsedSeconds <= timeLimitSeconds * SPEED_BONUS_FRACTION_OF_TIME ? SPEED_BONUS_POINTS : 0;
    pointsAwarded = Math.round(base * multiplier) + speedBonus;
  }

  // Wrong-answer penalty - only when the admin's toggle is on, only for
  // scored rounds, never for a paused question (already "no marks either
  // way"), and never for a genuine timeout (selectedIndex -1, auto-submitted
  // by app/quiz/page.tsx) - not answering isn't the same as answering wrong.
  let penalty = 0;
  if (!isCorrect && !isReview && !paused && selectedIndex !== -1 && (await getNegativeMarkingEnabled())) {
    penalty = wrongAnswerPenalty(level);
  }

  // Whether ANY question in this round (including this one) was paused -
  // disqualifies the round from a perfect-round bonus, same reasoning as
  // excluding paused answers from streaks above.
  const roundHasPaused =
    paused ||
    Number(
      (
        await queryOne<{ count: string }>(
          "SELECT count(*) FROM round_questions WHERE round_id = $1 AND paused = true",
          [roundId]
        )
      )?.count ?? 0
    ) > 0;

  const answeredAt = new Date().toISOString();
  const newCorrectCount = round.correct_count + (isCorrect ? 1 : 0);
  const newPointsAwarded = round.points_awarded + pointsAwarded - penalty;
  const isLastQuestion = position === totalQuestions - 1;
  const roundComplete = isLastQuestion;
  const perfectBonus =
    !isReview && isLastQuestion && newCorrectCount === totalQuestions && !roundHasPaused
      ? PERFECT_ROUND_BONUS[level]
      : 0;

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE round_questions SET answered_at = $1, selected_index = $2, is_correct = $3, points_awarded = $4, paused = $5
       WHERE round_id = $6 AND position = $7`,
      [answeredAt, selectedIndex, isCorrect, pointsAwarded - penalty, paused, roundId, position]
    );

    if (pointsAwarded > 0) {
      await tx.query(
        `INSERT INTO point_transactions (child_id, type, amount, reason, round_id)
         VALUES ($1, 'earn', $2, $3, $4)`,
        [kid.childId, pointsAwarded, `Correct answer (round ${roundId}, question ${position + 1})`, roundId]
      );
    }

    if (penalty > 0) {
      await tx.query(
        `INSERT INTO point_transactions (child_id, type, amount, reason, round_id)
         VALUES ($1, 'adjustment', $2, $3, $4)`,
        [kid.childId, -penalty, `Wrong answer penalty (round ${roundId}, question ${position + 1})`, roundId]
      );
    }

    if (isLastQuestion) {
      if (perfectBonus > 0) {
        await tx.query(
          `INSERT INTO point_transactions (child_id, type, amount, reason, round_id)
           VALUES ($1, 'earn', $2, $3, $4)`,
          [kid.childId, perfectBonus, `Perfect round bonus (round ${roundId})`, roundId]
        );
      }
      await tx.query(
        `UPDATE rounds SET status = 'completed', completed_at = $1, correct_count = $2, points_awarded = $3
         WHERE id = $4`,
        [answeredAt, newCorrectCount, newPointsAwarded + perfectBonus, roundId]
      );
    } else {
      await tx.query("UPDATE rounds SET correct_count = $1, points_awarded = $2 WHERE id = $3", [
        newCorrectCount,
        newPointsAwarded,
        roundId,
      ]);
    }
  });

  const newBalance = await getBalance(kid.childId);

  return NextResponse.json({
    isCorrect,
    timedOut: rawCorrect && !withinTime && !paused,
    correctIndex: rq.correct_index,
    explanation: rq.explanation,
    pointsAwarded,
    streak: isCorrect ? streak : 0,
    roundComplete,
    perfectBonus,
    correctCount: newCorrectCount,
    newBalance,
  });
}
