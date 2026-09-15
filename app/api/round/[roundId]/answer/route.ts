import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";
import {
  LEVELS,
  PERFECT_ROUND_BONUS,
  POINTS_PER_CORRECT,
  QUESTIONS_PER_ROUND,
  SPEED_BONUS_FRACTION_OF_TIME,
  SPEED_BONUS_POINTS,
  STREAK_MULTIPLIER,
  STREAK_THRESHOLD,
  type Level,
} from "@/lib/config";

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

  const db = supabaseAdmin();
  const { data: round } = await db
    .from("rounds")
    .select("id, child_id, level, status, correct_count, points_awarded")
    .eq("id", roundId)
    .single();
  if (!round || round.child_id !== kid.childId) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }
  if (round.status !== "in_progress") {
    return NextResponse.json({ error: "This round is already finished." }, { status: 409 });
  }

  const { data: rq } = await db
    .from("round_questions")
    .select("position, correct_index, explanation, shown_at, answered_at, category")
    .eq("round_id", roundId)
    .eq("position", position)
    .single();
  if (!rq) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (rq.answered_at) return NextResponse.json({ error: "Already answered." }, { status: 409 });
  if (!rq.shown_at) return NextResponse.json({ error: "Question was never served." }, { status: 409 });

  const level = round.level as Level;
  const timeLimitSeconds = LEVELS[level].perQuestionSeconds;
  const elapsedSeconds = (Date.now() - new Date(rq.shown_at).getTime()) / 1000;
  const withinTime = elapsedSeconds <= timeLimitSeconds + TIMEOUT_GRACE_SECONDS;

  const rawCorrect = selectedIndex === rq.correct_index;
  const isCorrect = rawCorrect && withinTime;

  // Current streak: consecutive correct answers ending at this one, looking
  // back over already-answered questions in this round.
  let pointsAwarded = 0;
  let streak = 0;
  if (isCorrect) {
    const { data: priorAnswers } = await db
      .from("round_questions")
      .select("position, is_correct")
      .eq("round_id", roundId)
      .lt("position", position)
      .order("position", { ascending: false });

    streak = 1;
    for (const prior of priorAnswers ?? []) {
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
  await db
    .from("round_questions")
    .update({
      answered_at: answeredAt,
      selected_index: selectedIndex,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    })
    .eq("round_id", roundId)
    .eq("position", position);

  const newCorrectCount = round.correct_count + (isCorrect ? 1 : 0);
  const newPointsAwarded = round.points_awarded + pointsAwarded;

  if (pointsAwarded > 0) {
    await db.from("point_transactions").insert({
      child_id: kid.childId,
      type: "earn",
      amount: pointsAwarded,
      reason: `Correct answer (round ${roundId}, question ${position + 1})`,
      round_id: roundId,
    });
  }

  const isLastQuestion = position === QUESTIONS_PER_ROUND - 1;
  let perfectBonus = 0;
  let roundComplete = false;

  if (isLastQuestion) {
    roundComplete = true;
    if (newCorrectCount === QUESTIONS_PER_ROUND) {
      perfectBonus = PERFECT_ROUND_BONUS[level];
      await db.from("point_transactions").insert({
        child_id: kid.childId,
        type: "earn",
        amount: perfectBonus,
        reason: `Perfect round bonus (round ${roundId})`,
        round_id: roundId,
      });
    }
    await db
      .from("rounds")
      .update({
        status: "completed",
        completed_at: answeredAt,
        correct_count: newCorrectCount,
        points_awarded: newPointsAwarded + perfectBonus,
      })
      .eq("id", roundId);
  } else {
    await db
      .from("rounds")
      .update({ correct_count: newCorrectCount, points_awarded: newPointsAwarded })
      .eq("id", roundId);
  }

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
