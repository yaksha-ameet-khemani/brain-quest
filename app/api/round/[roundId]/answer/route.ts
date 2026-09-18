import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";
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

export async function POST(req: Request, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const position: number | undefined = body?.position;
  const selectedIndex: number | undefined = body?.selectedIndex;
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
  const isCorrect = rawCorrect && withinTime;
  const isReview = round.kind === "review";

  const totalQuestionsRow = await queryOne<{ count: string }>(
    "SELECT count(*) FROM round_questions WHERE round_id = $1",
    [roundId]
  );
  const totalQuestions = Number(totalQuestionsRow?.count ?? position + 1);

  // Current streak: consecutive correct answers ending at this one, looking
  // back over already-answered questions in this round. Review rounds are
  // practice only - never scored, so skip all of this (see lib/config.ts).
  let pointsAwarded = 0;
  let streak = 0;
  if (isCorrect && !isReview) {
    const priorAnswers = await query<Pick<RoundQuestionRow, "position" | "is_correct">>(
      "SELECT position, is_correct FROM round_questions WHERE round_id = $1 AND position < $2 ORDER BY position DESC",
      [roundId, position]
    );

    streak = 1;
    for (const prior of priorAnswers) {
      if (prior.is_correct) streak++;
      else break;
    }

    const base = POINTS_PER_CORRECT[level];
    const multiplier = streak >= STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1;
    const speedBonus =
      elapsedSeconds <= timeLimitSeconds * SPEED_BONUS_FRACTION_OF_TIME ? SPEED_BONUS_POINTS : 0;
    pointsAwarded = Math.round(base * multiplier) + speedBonus;
  }

  const answeredAt = new Date().toISOString();
  const newCorrectCount = round.correct_count + (isCorrect ? 1 : 0);
  const newPointsAwarded = round.points_awarded + pointsAwarded;
  const isLastQuestion = position === totalQuestions - 1;
  const roundComplete = isLastQuestion;
  const perfectBonus =
    !isReview && isLastQuestion && newCorrectCount === totalQuestions ? PERFECT_ROUND_BONUS[level] : 0;

  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE round_questions SET answered_at = $1, selected_index = $2, is_correct = $3, points_awarded = $4
       WHERE round_id = $5 AND position = $6`,
      [answeredAt, selectedIndex, isCorrect, pointsAwarded, roundId, position]
    );

    if (pointsAwarded > 0) {
      await tx.query(
        `INSERT INTO point_transactions (child_id, type, amount, reason, round_id)
         VALUES ($1, 'earn', $2, $3, $4)`,
        [kid.childId, pointsAwarded, `Correct answer (round ${roundId}, question ${position + 1})`, roundId]
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
    timedOut: rawCorrect && !withinTime,
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
