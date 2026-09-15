import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireKid } from "@/lib/requireKid";
import { buildRoundQuestions } from "@/lib/buildRound";
import { sanitizeQuestion } from "@/lib/sanitizeQuestion";
import { todayRangeUtc } from "@/lib/timezone";
import { LEVELS, MAX_ROUNDS_PER_DAY, QUESTIONS_PER_ROUND, type Level } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const db = supabaseAdmin();

  const { data: child, error: childError } = await db
    .from("children")
    .select("id, level")
    .eq("id", kid.childId)
    .single();
  if (childError || !child) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const level = child.level as Level;

  // Resume an existing in-progress round rather than starting a new one -
  // so closing the browser mid-quiz doesn't lose progress or burn a daily slot.
  const { data: existingRound } = await db
    .from("rounds")
    .select("id, level")
    .eq("child_id", kid.childId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRound) {
    const payload = await loadRoundForResume(existingRound.id);
    if (payload) return NextResponse.json(payload);
    // Fell through: the in-progress round had no unanswered question left
    // (shouldn't normally happen - answer route completes it) - mark it
    // abandoned so the child isn't stuck, then fall through to a fresh round.
    await db.from("rounds").update({ status: "abandoned" }).eq("id", existingRound.id);
  }

  const { start, end } = todayRangeUtc();
  const { count, error: countError } = await db
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("child_id", kid.childId)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString());
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) >= MAX_ROUNDS_PER_DAY) {
    return NextResponse.json(
      { error: "You've played all your rounds for today. Come back tomorrow!" },
      { status: 403 }
    );
  }

  const drafts = await buildRoundQuestions(level, kid.childId);

  const { data: round, error: roundError } = await db
    .from("rounds")
    .insert({ child_id: kid.childId, level })
    .select("id")
    .single();
  if (roundError || !round) {
    return NextResponse.json({ error: roundError?.message ?? "Could not start round." }, { status: 500 });
  }

  const rows = drafts.map((d, position) => ({
    round_id: round.id,
    position,
    source: d.source,
    question_id: d.questionId,
    category: d.category,
    question_text: d.questionText,
    options: d.options,
    correct_index: d.correctIndex,
    explanation: d.explanation,
    shown_at: position === 0 ? new Date().toISOString() : null,
  }));

  const { error: insertError } = await db.from("round_questions").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const firstRow = rows[0];
  if (!firstRow) {
    return NextResponse.json({ error: "Could not build round questions." }, { status: 500 });
  }

  return NextResponse.json({
    roundId: round.id,
    level,
    totalQuestions: QUESTIONS_PER_ROUND,
    timeLimitSeconds: LEVELS[level].perQuestionSeconds,
    question: sanitizeQuestion({
      position: 0,
      category: firstRow.category,
      question_text: firstRow.question_text,
      options: firstRow.options,
      shown_at: firstRow.shown_at,
    }),
  });
}

async function loadRoundForResume(roundId: string) {
  const db = supabaseAdmin();
  const { data: round } = await db.from("rounds").select("id, level").eq("id", roundId).single();
  if (!round) return null;

  const { data: nextQ } = await db
    .from("round_questions")
    .select("position, category, question_text, options, shown_at")
    .eq("round_id", roundId)
    .is("answered_at", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextQ) return null;

  if (!nextQ.shown_at) {
    await db
      .from("round_questions")
      .update({ shown_at: new Date().toISOString() })
      .eq("round_id", roundId)
      .eq("position", nextQ.position);
    nextQ.shown_at = new Date().toISOString();
  }

  const level = round.level as Level;
  return {
    roundId: round.id,
    level,
    totalQuestions: QUESTIONS_PER_ROUND,
    timeLimitSeconds: LEVELS[level].perQuestionSeconds,
    question: sanitizeQuestion(nextQ),
  };
}
