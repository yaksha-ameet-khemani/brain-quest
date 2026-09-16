import "server-only";
import { query } from "@/lib/db";
import { generateMathQuestions } from "@/lib/mathQuestions";
import { getCategoryWeights, pickWeightedCategories } from "@/lib/categoryWeights";
import { BANK_CATEGORIES, QUESTIONS_PER_ROUND, type BankCategory, type Level } from "@/lib/config";
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

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function toDraft(q: QuestionRow): RoundQuestionDraft {
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
}

function generatedDraft(level: Level): RoundQuestionDraft {
  const [q] = generateMathQuestions(level, 1);
  return {
    source: "generated",
    questionId: null,
    category: q!.category,
    questionText: q!.questionText,
    options: q!.options,
    correctIndex: q!.correctIndex,
    explanation: q!.explanation,
  };
}

/** Picks QUESTIONS_PER_ROUND questions for a round. Which category each of
 * the 5 slots draws from is a weighted random pick per child (admin-tunable
 * via lib/categoryWeights.ts - e.g. weight logic higher for a child who's
 * shaky on it). Bank categories (logic/riddle/spatial) pull from the
 * curated, admin-managed question bank with options re-shuffled per
 * serving; math is generated fresh every time and never runs dry. Falls
 * back gracefully (never fails to build a round) if a category's bank pool
 * is empty at this child's level - tries another category with something
 * available, then generated math as the final fallback since that's always
 * available. */
export async function buildRoundQuestions(level: Level, childId: string): Promise<RoundQuestionDraft[]> {
  const weights = await getCategoryWeights(childId);
  const wantedCategories = pickWeightedCategories(weights, QUESTIONS_PER_ROUND);

  const bankRows = await query<QuestionRow>(
    "SELECT id, category, question_text, options, correct_option_index, explanation FROM questions WHERE level = $1 AND is_active = true",
    [level]
  );
  const bankByCategory = new Map<BankCategory, QuestionRow[]>(BANK_CATEGORIES.map((c) => [c, []]));
  for (const row of bankRows) {
    bankByCategory.get(row.category)?.push(row);
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

  const usedThisRound = new Set<string>();

  function pickFromCategory(category: BankCategory): QuestionRow | null {
    const pool = (bankByCategory.get(category) ?? []).filter((q) => !usedThisRound.has(q.id));
    if (pool.length === 0) return null;
    const unseen = pool.filter((q) => !recentIds.has(q.id));
    return pickRandom(unseen.length > 0 ? unseen : pool);
  }

  const drafts: RoundQuestionDraft[] = [];
  for (const category of wantedCategories) {
    if (category === "math") {
      drafts.push(generatedDraft(level));
      continue;
    }

    let picked = pickFromCategory(category);
    if (!picked) {
      // Nothing left in the requested category - try any other bank
      // category that still has something, before finally falling back to
      // generated math (always available, never empty).
      for (const fallback of BANK_CATEGORIES) {
        picked = pickFromCategory(fallback);
        if (picked) break;
      }
    }

    if (picked) {
      usedThisRound.add(picked.id);
      drafts.push(toDraft(picked));
    } else {
      drafts.push(generatedDraft(level));
    }
  }

  return drafts;
}
