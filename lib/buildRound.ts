import "server-only";
import { query } from "@/lib/db";
import { generateMathQuestions } from "@/lib/mathQuestions";
import { QUESTIONS_PER_ROUND, type Level } from "@/lib/config";
import type { QuestionRow } from "@/lib/types";

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

  const bankPool = await query<QuestionRow>(
    "SELECT id, category, question_text, options, correct_option_index, explanation FROM questions WHERE level = $1 AND is_active = true",
    [level]
  );
  if (bankPool.length === 0) {
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

  const childRounds = await query<{ id: string }>("SELECT id FROM rounds WHERE child_id = $1", [childId]);
  const roundIds = childRounds.map((r) => r.id);

  let recentIds = new Set<string>();
  if (roundIds.length > 0) {
    const recent = await query<{ question_id: string | null }>(
      `SELECT question_id FROM round_questions
       WHERE round_id = ANY($1::uuid[]) AND source = 'bank'
       ORDER BY shown_at DESC NULLS LAST LIMIT 30`,
      [roundIds]
    );
    recentIds = new Set(recent.map((r) => r.question_id).filter((id): id is string => Boolean(id)));
  }

  const unseen = bankPool.filter((q) => !recentIds.has(q.id));
  const pool = unseen.length >= BANK_COUNT ? unseen : bankPool;
  const chosen = shuffleArray(pool).slice(0, Math.min(BANK_COUNT, pool.length));

  const bankDrafts: RoundQuestionDraft[] = chosen.map((q) => {
    const { options, correctIndex } = shuffleWithCorrectTracking(q.options, q.correct_option_index);
    return {
      source: "bank",
      questionId: q.id,
      category: q.category,
      questionText: q.question_text,
      options,
      correctIndex,
      explanation: q.explanation,
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
