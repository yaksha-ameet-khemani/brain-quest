import "server-only";
import { query } from "@/lib/db";
import { generateMathQuestions, generateMathQuestionByKey } from "@/lib/mathQuestions";
import { getCategoryWeights, pickWeightedCategories } from "@/lib/categoryWeights";
import {
  BANK_CATEGORIES,
  MAX_CHECKUP_QUESTIONS,
  MAX_REVIEW_QUESTIONS,
  QUESTIONS_PER_ROUND,
  type BankCategory,
  type Level,
} from "@/lib/config";
import type { QuestionRow } from "@/lib/types";

export interface RoundQuestionDraft {
  source: "bank" | "generated";
  questionId: string | null;
  templateKey: string | null; // which math generator template produced this (generated only)
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

export function toDraft(q: QuestionRow): RoundQuestionDraft {
  const { options, correctIndex } = shuffleWithCorrectTracking(q.options, q.correct_option_index);
  return {
    source: "bank",
    questionId: q.id,
    templateKey: null,
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
    templateKey: q!.templateKey,
    category: q!.category,
    questionText: q!.questionText,
    options: q!.options,
    correctIndex: q!.correctIndex,
    explanation: q!.explanation,
  };
}

/** Regenerates a question from a specific math template (new random
 * numbers, same underlying skill) - used by buildCheckupQuestions to
 * "recheck" a template the child previously got wrong. */
function generatedDraftByKey(level: Level, templateKey: string): RoundQuestionDraft {
  const q = generateMathQuestionByKey(level, templateKey);
  return {
    source: "generated",
    questionId: null,
    templateKey: q.templateKey,
    category: q.category,
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
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

/** Picks up to MAX_REVIEW_QUESTIONS bank questions whose most recent attempt
 * by this child was wrong, most-recently-missed first - for a "review round"
 * that's never scored (see lib/config.ts). Only bank questions qualify:
 * generated math is different numbers every time, so there's no fixed
 * question to "get right this time." A question the child answers correctly
 * on review naturally drops off next time, since this always looks at the
 * MOST RECENT attempt, not just the first mistake - free spaced repetition,
 * not additional bookkeeping. Returns an empty array if there's nothing to
 * review right now (caller should treat that as "review not available").
 */
export async function buildReviewQuestions(childId: string): Promise<RoundQuestionDraft[]> {
  const rows = await query<QuestionRow>(
    `SELECT q.id, q.category, q.question_text, q.options, q.correct_option_index, q.explanation
     FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct, rq.answered_at
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1
         AND rq.source = 'bank'
         AND rq.question_id IS NOT NULL
         AND rq.answered_at IS NOT NULL
       ORDER BY rq.question_id, rq.answered_at DESC
     ) latest
     JOIN questions q ON q.id = latest.question_id
     WHERE latest.is_correct = false AND q.is_active = true
     ORDER BY latest.answered_at DESC
     LIMIT $2`,
    [childId, MAX_REVIEW_QUESTIONS]
  );

  return rows.map(toDraft);
}

/** Finds a bank question to stand in for `original` on a checkup - same
 * skill, but NOT the same question, since getting the literal question
 * right again would just be memorization. Prefers another active question
 * at the same level sharing `original`'s admin-set concept tag; falls back
 * to any other active question in the same category if there's no tagged
 * match (or no tag at all). Returns null if nothing else is available. */
async function pickSimilarBankQuestion(original: QuestionRow, excludeIds: Set<string>): Promise<QuestionRow | null> {
  if (original.concept) {
    const byConcept = await query<QuestionRow>(
      `SELECT id, level, category, question_text, options, correct_option_index, explanation, concept, is_active, created_at
       FROM questions WHERE level = $1 AND concept = $2 AND is_active = true AND id != $3`,
      [original.level, original.concept, original.id]
    );
    const pool = byConcept.filter((q) => !excludeIds.has(q.id));
    if (pool.length > 0) return pickRandom(pool);
  }

  const byCategory = await query<QuestionRow>(
    `SELECT id, level, category, question_text, options, correct_option_index, explanation, concept, is_active, created_at
     FROM questions WHERE level = $1 AND category = $2 AND is_active = true AND id != $3`,
    [original.level, original.category, original.id]
  );
  const pool = byCategory.filter((q) => !excludeIds.has(q.id));
  return pool.length > 0 ? pickRandom(pool) : null;
}

type CheckupWrongItem =
  | { kind: "bank"; row: QuestionRow; answeredAt: string }
  | { kind: "generated"; level: Level; templateKey: string; answeredAt: string };

/** Picks up to MAX_CHECKUP_QUESTIONS questions for a child's daily
 * "checkup" - see lib/checkupProgress.ts for when this is due. Unlike
 * buildReviewQuestions, this never replays the exact question the child
 * got wrong: bank questions are swapped for a different one testing the
 * same concept/category (pickSimilarBankQuestion), and generated (math)
 * questions are regenerated from the same template with new numbers
 * (generateMathQuestionByKey) - so answering correctly this time is real
 * evidence of understanding, not recall. Falls back to literally repeating
 * a bank question only if there's truly nothing else to swap it for.
 * Returns an empty array if there's nothing to check up on right now. */
export async function buildCheckupQuestions(childId: string): Promise<RoundQuestionDraft[]> {
  const wrongBank = await query<QuestionRow & { answered_at: string }>(
    `SELECT q.id, q.level, q.category, q.question_text, q.options, q.correct_option_index, q.explanation,
            q.concept, q.is_active, q.created_at, latest.answered_at
     FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct, rq.answered_at
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'bank' AND rq.question_id IS NOT NULL AND rq.answered_at IS NOT NULL
       ORDER BY rq.question_id, rq.answered_at DESC
     ) latest
     JOIN questions q ON q.id = latest.question_id
     WHERE latest.is_correct = false AND q.is_active = true
     ORDER BY latest.answered_at DESC`,
    [childId]
  );

  const wrongGenerated = await query<{ template_key: string; level: Level; answered_at: string }>(
    `SELECT t.template_key, t.level, t.answered_at
     FROM (
       SELECT DISTINCT ON (rq.template_key) rq.template_key, rq.is_correct, rq.answered_at, r.level
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'generated' AND rq.template_key IS NOT NULL AND rq.answered_at IS NOT NULL
       ORDER BY rq.template_key, rq.answered_at DESC
     ) t
     WHERE t.is_correct = false
     ORDER BY t.answered_at DESC`,
    [childId]
  );

  const combined: CheckupWrongItem[] = [
    ...wrongBank.map((row) => ({ kind: "bank" as const, row, answeredAt: row.answered_at })),
    ...wrongGenerated.map((g) => ({
      kind: "generated" as const,
      level: g.level,
      templateKey: g.template_key,
      answeredAt: g.answered_at,
    })),
  ];
  combined.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
  const chosen = combined.slice(0, MAX_CHECKUP_QUESTIONS);

  const drafts: RoundQuestionDraft[] = [];
  const usedBankIds = new Set<string>();
  for (const item of chosen) {
    if (item.kind === "generated") {
      drafts.push(generatedDraftByKey(item.level, item.templateKey));
      continue;
    }
    const substitute = await pickSimilarBankQuestion(item.row, usedBankIds);
    if (substitute) {
      usedBankIds.add(substitute.id);
      drafts.push(toDraft(substitute));
    } else {
      // Nothing else to swap it for - repeating it is still better than
      // skipping the recheck entirely.
      drafts.push(toDraft(item.row));
    }
  }

  return drafts;
}
