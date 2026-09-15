import "server-only";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { generateMathQuestions } from "@/lib/mathQuestions";
import { QUESTIONS_PER_ROUND, type Level } from "@/lib/config";

export interface RoundQuestionDraft {
  source: "bank" | "generated";
  questionId: string | null;
  category: string;
  questionText: string;
  options: string[]; // shuffled, display order
  correctIndex: number; // index into `options` above
  explanation: string;
}

function shuffleWithCorrectTracking(options: string[], correctIndex: number): { options: string[]; correctIndex: number } {
  const correctValue = options[correctIndex]!;
  const indices = options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  const shuffled = indices.map((i) => options[i]!);
  return { options: shuffled, correctIndex: shuffled.indexOf(correctValue) };
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Picks QUESTIONS_PER_ROUND questions for a round: a mix of curated bank
 * questions (logic/riddle/spatial, options re-shuffled per serving so the
 * stored order never leaks a pattern) and freshly generated math questions
 * (which never run out). Bank questions the child has seen recently are
 * avoided when there's enough pool left to do so. */
export async function buildRoundQuestions(level: Level, childId: string): Promise<RoundQuestionDraft[]> {
  const BANK_COUNT = 3;

  const { data: bankPool, error: poolError } = await supabaseAdmin()
    .from("questions")
    .select("id, category, question_text, options, correct_option_index, explanation")
    .eq("level", level)
    .eq("is_active", true);
  if (poolError) throw new Error(poolError.message);
  if (!bankPool || bankPool.length === 0) {
    // No curated questions seeded yet - fall back to an all-generated round
    // rather than failing the whole round outright.
    const generated = generateMathQuestions(level, QUESTIONS_PER_ROUND);
    return shuffleArray(
      generated.map((q) => ({
        source: "generated" as const,
        questionId: null,
        category: q.category,
        questionText: q.questionText,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }))
    );
  }

  // Two-step instead of an embedded `rounds!inner(...)` select - simpler to
  // type correctly and just as cheap at this data size.
  const { data: childRounds } = await supabaseAdmin().from("rounds").select("id").eq("child_id", childId);
  const roundIds = (childRounds ?? []).map((r) => r.id);

  let recentIds = new Set<string>();
  if (roundIds.length > 0) {
    const { data: recent } = await supabaseAdmin()
      .from("round_questions")
      .select("question_id")
      .in("round_id", roundIds)
      .eq("source", "bank")
      .order("shown_at", { ascending: false })
      .limit(30);
    recentIds = new Set((recent ?? []).map((r) => r.question_id).filter((id): id is string => Boolean(id)));
  }

  const unseen = bankPool.filter((q) => !recentIds.has(q.id));
  const pool = unseen.length >= BANK_COUNT ? unseen : bankPool;
  const chosen = shuffleArray(pool).slice(0, Math.min(BANK_COUNT, pool.length));

  const bankDrafts: RoundQuestionDraft[] = chosen.map((q) => {
    const { options, correctIndex } = shuffleWithCorrectTracking(
      q.options as string[],
      q.correct_option_index as number
    );
    return {
      source: "bank",
      questionId: q.id as string,
      category: q.category as string,
      questionText: q.question_text as string,
      options,
      correctIndex,
      explanation: q.explanation as string,
    };
  });

  const neededGenerated = QUESTIONS_PER_ROUND - bankDrafts.length;
  const generated = generateMathQuestions(level, neededGenerated);
  const generatedDrafts: RoundQuestionDraft[] = generated.map((q) => ({
    source: "generated",
    questionId: null,
    category: q.category,
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));

  return shuffleArray([...bankDrafts, ...generatedDrafts]);
}
