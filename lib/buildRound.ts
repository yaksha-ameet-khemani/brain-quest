import "server-only";
import { query } from "@/lib/db";
import { generateMathQuestionWithKey, generateMathQuestionByKey, type GeneratedQuestionWithKey } from "@/lib/mathQuestions";
import { getCategoryWeights, pickWeightedCategories } from "@/lib/categoryWeights";
import { buildSkillMap } from "@/lib/skillMap";
import { MATH_TEMPLATE_SKILL } from "@/lib/skills";
import { templateKeysFor } from "@/lib/mathQuestions";
import { mathTemplateGate } from "@/lib/mathRules";
import {
  BANK_CATEGORIES,
  GENERATED_REPEAT_WINDOW_DAYS,
  GENERATED_REROLL_ATTEMPTS,
  MAX_CHECKUP_QUESTIONS,
  MAX_REVIEW_QUESTIONS,
  QUESTIONS_PER_ROUND,
  RECENT_QUESTION_WINDOW_HOURS,
  WEAK_SKILL_MAX_PCT,
  WEAK_SKILL_SHARE,
  type BankCategory,
  type Level,
} from "@/lib/config";
import { generateAvoiding, pickLeastRecentlySeen, pickNotRecentlySeen } from "@/lib/recentQuestions";
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
  penPaper: boolean; // served with the longer pen & paper timer - see lib/questionTiming.ts
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
    penPaper: q.pen_paper,
  };
}

/** Exact texts of every generated question this child was shown in the
 * last GENERATED_REPEAT_WINDOW_DAYS days (any round kind). Generated math has
 * no question id, so the text is the only way to tell "12 x 10 rectangle"
 * from "12 x 9 rectangle". */
async function recentGeneratedTexts(childId: string): Promise<Set<string>> {
  const rows = await query<{ question_text: string }>(
    `SELECT DISTINCT rq.question_text
     FROM round_questions rq
     JOIN rounds r ON r.id = rq.round_id
     WHERE r.child_id = $1 AND rq.source = 'generated' AND rq.shown_at IS NOT NULL
       AND rq.shown_at > now() - make_interval(days => $2)`,
    [childId, GENERATED_REPEAT_WINDOW_DAYS]
  );
  return new Set(rows.map((r) => r.question_text));
}

function draftFromGenerated(q: GeneratedQuestionWithKey): RoundQuestionDraft {
  return {
    source: "generated",
    questionId: null,
    templateKey: q.templateKey,
    category: q.category,
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    penPaper: q.penPaper,
  };
}

/** A fresh generated math question the child hasn't seen recently - see
 * recentGeneratedTexts() and generateAvoiding() - from a template the
 * child's math rules allow (lib/mathRules.ts). */
function generatedDraft(level: Level, avoid: Set<string>, allowed: (templateKey: string) => boolean): RoundQuestionDraft {
  return draftFromGenerated(
    generateAvoiding(() => generateMathQuestionWithKey(level, allowed), avoid, GENERATED_REROLL_ATTEMPTS)
  );
}

/** Regenerates a question from a specific math template (new random
 * numbers, same underlying skill) - used by buildCheckupQuestions to
 * "recheck" a template the child previously got wrong. Same recent-repeat
 * avoidance as generatedDraft, but always the same template. */
function generatedDraftByKey(level: Level, templateKey: string, avoid: Set<string>): RoundQuestionDraft {
  return draftFromGenerated(
    generateAvoiding(() => generateMathQuestionByKey(level, templateKey), avoid, GENERATED_REROLL_ATTEMPTS)
  );
}

/** Skills this child is clearly weak in - skill map state "learning" or
 * "guessing" with at most WEAK_SKILL_MAX_PCT right recently. What standard
 * rounds lean toward. */
async function weakSkillKeys(childId: string, level: Level): Promise<Set<string>> {
  const { rows } = await buildSkillMap(childId, level);
  return new Set(
    rows
      .filter(
        (r) =>
          (r.state === "learning" || r.state === "guessing") &&
          r.recentCorrect * 100 <= WEAK_SKILL_MAX_PCT * r.recentAnswered
      )
      .map((r) => r.key)
  );
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
 * available.
 *
 * Weak skills: after a slot's category is chosen, WEAK_SKILL_SHARE of the
 * time it is narrowed to the child's weak skills in that category (bank
 * questions by skill_key, math by template via MATH_TEMPLATE_SKILL). If the
 * child has no weak skill there, or no unseen question on one, the slot is filled
 * the normal way - weights alone still decide how many of each category. */
export async function buildRoundQuestions(level: Level, childId: string): Promise<RoundQuestionDraft[]> {
  const weights = await getCategoryWeights(childId);
  const wantedCategories = pickWeightedCategories(weights, QUESTIONS_PER_ROUND);
  const weakSkills = await weakSkillKeys(childId, level);
  const weakTemplates = templateKeysFor(level).filter((k) => weakSkills.has(MATH_TEMPLATE_SKILL[k] ?? ""));
  const mathGate = await mathTemplateGate(childId);

  const bankRows = await query<QuestionRow>(
    "SELECT id, category, question_text, options, correct_option_index, explanation, pen_paper, skill_key FROM questions WHERE level = $1 AND is_active = true AND in_rotation = true",
    [level]
  );
  const bankByCategory = new Map<BankCategory, QuestionRow[]>(BANK_CATEGORIES.map((c) => [c, []]));
  for (const row of bankRows) {
    bankByCategory.get(row.category)?.push(row);
  }

  const childRounds = await query<{ id: string }>("SELECT id FROM rounds WHERE child_id = $1", [childId]);
  const roundIds = childRounds.map((r) => r.id);

  // Every bank question this child has EVER been shown (any round kind),
  // with the most recent time each one was shown - not just the last 30
  // shows. A fixed-size "last 30" window used to get blown through in a
  // single busy session (several rounds plus a review/checkup back to
  // back), letting a question already seen earlier that same day resurface
  // a round or two later. Tracking the whole history instead means a
  // question can only repeat once every question in its (level, category)
  // bank bucket has already been shown at least once.
  let lastShownAt = new Map<string, number>();
  if (roundIds.length > 0) {
    const shown = await query<{ question_id: string; last_shown_at: string }>(
      `SELECT question_id, MAX(shown_at) AS last_shown_at
       FROM round_questions
       WHERE round_id = ANY($1::uuid[]) AND source = 'bank' AND question_id IS NOT NULL AND shown_at IS NOT NULL
       GROUP BY question_id`,
      [roundIds]
    );
    lastShownAt = new Map(shown.map((r) => [r.question_id, new Date(r.last_shown_at).getTime()]));
  }

  const usedThisRound = new Set<string>();
  const avoidGenerated = await recentGeneratedTexts(childId);

  function pickFromCategory(category: BankCategory, weakOnly = false): QuestionRow | null {
    const pool = (bankByCategory.get(category) ?? []).filter(
      (q) => !usedThisRound.has(q.id) && (!weakOnly || (q.skill_key !== null && weakSkills.has(q.skill_key)))
    );
    if (pool.length === 0) return null;

    const neverShown = pool.filter((q) => !lastShownAt.has(q.id));
    if (weakOnly) {
      // Pick the skill first, then a question on it - otherwise a weak skill
      // with many bank questions (rotation: 77 at Level 1) crowds out one with
      // few (clocks: 16). Never repeats a question: weak pools are small, and
      // a remembered answer isn't practice. The caller falls back to a normal pick.
      if (neverShown.length === 0) return null;
      const skill = pickRandom([...new Set(neverShown.map((q) => q.skill_key))]);
      return pickRandom(neverShown.filter((q) => q.skill_key === skill));
    }
    if (neverShown.length > 0) return pickRandom(neverShown);

    // This child has now seen every active question in this bucket at
    // least once - a repeat is unavoidable, so pick from the
    // least-recently-shown fifth of the pool instead of uniformly at
    // random, to keep whatever just got repeated from coming right back.
    const sorted = [...pool].sort((a, b) => (lastShownAt.get(a.id) ?? 0) - (lastShownAt.get(b.id) ?? 0));
    const staleSliceSize = Math.max(1, Math.ceil(sorted.length * 0.2));
    return pickRandom(sorted.slice(0, staleSliceSize));
  }

  const drafts: RoundQuestionDraft[] = [];
  for (const category of wantedCategories) {
    const leanWeak = Math.random() < WEAK_SKILL_SHARE;
    if (category === "math") {
      const weakAllowed = weakTemplates.filter(mathGate.allowed);
      const draft =
        leanWeak && weakAllowed.length > 0
          ? generatedDraftByKey(level, pickRandom(weakAllowed), avoidGenerated)
          : generatedDraft(level, avoidGenerated, mathGate.allowed);
      mathGate.markServed(draft.templateKey!);
      drafts.push(draft);
      continue;
    }

    let picked = (leanWeak ? pickFromCategory(category, true) : null) ?? pickFromCategory(category);
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
      const draft = generatedDraft(level, avoidGenerated, mathGate.allowed);
      mathGate.markServed(draft.templateKey!);
      drafts.push(draft);
    }
  }

  return drafts;
}

/** Picks up to MAX_REVIEW_QUESTIONS bank questions whose most recent attempt
 * by this child was wrong, most-recently-missed first - for a "review round"
 * that's never scored (see lib/config.ts). Only bank questions qualify:
 * generated math is different numbers every time, so there's no fixed
 * question to "get right this time."
 *
 * Each one is swapped for a DIFFERENT question testing the same skill
 * (pickSimilarBankQuestion - the same substitution buildCheckupQuestions
 * uses below), never the literal question the child already saw. This used
 * to serve the exact original question back verbatim ("free spaced
 * repetition"), but that let a child who simply remembered the specific
 * question/answer from last time sail through review without ever
 * re-deriving it - confirmed against real production data (a child was
 * served the identical 5 questions, same order, that a standard round had
 * shown minutes-to-a-day earlier). Falls back to literally repeating the
 * original only if there's truly nothing else on that skill to swap it for
 * (same last-resort as checkup). Returns an empty array if there's nothing
 * to review right now (caller should treat that as "review not available").
 */
export async function buildReviewQuestions(childId: string): Promise<RoundQuestionDraft[]> {
  const rows = await query<QuestionRow>(
    `SELECT q.id, q.level, q.category, q.question_text, q.options, q.correct_option_index, q.explanation, q.concept, q.skill_key, q.is_active, q.pen_paper, q.created_at
     FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct, rq.answered_at
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1
         AND r.kind <> 'practice'
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

  const drafts: RoundQuestionDraft[] = [];
  // Pre-seeded with every original wrong question's own id, not just
  // substitutes picked so far - otherwise a substitute chosen for one item
  // could coincide with another item still waiting in this same batch.
  const usedIds = new Set<string>(rows.map((r) => r.id));
  for (const row of rows) {
    const substitute = await pickSimilarBankQuestion(row, usedIds, childId);
    const chosen = substitute ?? row;
    usedIds.add(chosen.id);
    drafts.push(toDraft(chosen));
  }
  return drafts;
}

/** Finds a bank question to stand in for `original` on a checkup or review
 * round - same skill, but NOT the same question, since getting the literal
 * question right again would just be memorization/recall rather than real
 * evidence of understanding. Prefers another active question at the same
 * level with the same skill (questions.skill_key, lib/skills.ts) - from any
 * category, since skills cut across categories; falls back to any other
 * active question in the same category if the skill has nothing usable (or
 * the question has no skill). Returns null if nothing else is available.
 * (This used the free-text `concept` tag until the skill map existed; no
 * question ever had a concept, so "similar" had only ever meant "same
 * category".)
 *
 * Never hands back a question this child was shown within the last
 * RECENT_QUESTION_WINDOW_HOURS (any round kind): kids remember what they
 * answered a day or two ago, so a "fresh" question they already know proves
 * nothing. Never-shown questions are preferred over merely-old ones. This
 * used to pick uniformly at random from the whole pool, which served a child
 * a question they had answered correctly three minutes earlier. Only if
 * EVERY candidate was shown inside the window does it fall back to the one
 * shown longest ago. */
async function pickSimilarBankQuestion(
  original: QuestionRow,
  excludeIds: Set<string>,
  childId: string
): Promise<QuestionRow | null> {
  const pools: QuestionRow[][] = [];
  if (original.skill_key) {
    const bySkill = await query<QuestionRow>(
      `SELECT id, level, category, question_text, options, correct_option_index, explanation, concept, skill_key, is_active, pen_paper, created_at
       FROM questions WHERE level = $1 AND skill_key = $2 AND is_active = true AND in_rotation = true AND id != $3`,
      [original.level, original.skill_key, original.id]
    );
    pools.push(bySkill.filter((q) => !excludeIds.has(q.id)));
  }

  const byCategory = await query<QuestionRow>(
    `SELECT id, level, category, question_text, options, correct_option_index, explanation, concept, skill_key, is_active, pen_paper, created_at
     FROM questions WHERE level = $1 AND category = $2 AND is_active = true AND in_rotation = true AND id != $3`,
    [original.level, original.category, original.id]
  );
  const categoryPool = byCategory.filter((q) => !excludeIds.has(q.id));
  pools.push(categoryPool);
  if (pools.every((p) => p.length === 0)) return null;

  const candidateIds = [...new Set(pools.flat().map((q) => q.id))];
  const shown = await query<{ question_id: string; last_shown_at: string }>(
    `SELECT rq.question_id, MAX(rq.shown_at) AS last_shown_at
     FROM round_questions rq
     JOIN rounds r ON r.id = rq.round_id
     WHERE r.child_id = $1 AND rq.question_id = ANY($2::uuid[]) AND rq.shown_at IS NOT NULL
     GROUP BY rq.question_id`,
    [childId, candidateIds]
  );
  const lastShownAt = new Map(shown.map((r) => [r.question_id, new Date(r.last_shown_at).getTime()]));
  const cutoffMs = Date.now() - RECENT_QUESTION_WINDOW_HOURS * 60 * 60 * 1000;

  // Skill pool first, then the wider category pool - but only settle for a
  // pool once it has something outside the recent-memory window.
  for (const pool of pools) {
    const fresh = pickNotRecentlySeen(pool, lastShownAt, cutoffMs, pickRandom);
    if (fresh) return fresh;
  }
  return pickLeastRecentlySeen(pools.flat(), lastShownAt);
}

type CheckupWrongItem =
  | { kind: "bank"; row: QuestionRow; answeredAt: string }
  | { kind: "generated"; level: Level; templateKey: string; answeredAt: string };

/** Picks up to MAX_CHECKUP_QUESTIONS questions for a child's daily
 * "checkup" - see lib/checkupProgress.ts for when this is due. Unlike
 * buildReviewQuestions, this never replays the exact question the child
 * got wrong: bank questions are swapped for a different one testing the
 * same skill (pickSimilarBankQuestion), and generated (math)
 * questions are regenerated from the same template with new numbers
 * (generateMathQuestionByKey) - so answering correctly this time is real
 * evidence of understanding, not recall. Falls back to literally repeating
 * a bank question only if there's truly nothing else to swap it for.
 * Returns an empty array if there's nothing to check up on right now. */
export async function buildCheckupQuestions(childId: string): Promise<RoundQuestionDraft[]> {
  const wrongBank = await query<QuestionRow & { answered_at: string }>(
    `SELECT q.id, q.level, q.category, q.question_text, q.options, q.correct_option_index, q.explanation,
            q.concept, q.skill_key, q.is_active, q.pen_paper, q.created_at, latest.answered_at
     FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct, rq.answered_at
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND r.kind <> 'practice' AND rq.source = 'bank' AND rq.question_id IS NOT NULL AND rq.answered_at IS NOT NULL
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
       WHERE r.child_id = $1 AND r.kind <> 'practice' AND rq.source = 'generated' AND rq.template_key IS NOT NULL AND rq.answered_at IS NOT NULL
       ORDER BY rq.template_key, rq.answered_at DESC
     ) t
     WHERE t.is_correct = false
     ORDER BY t.answered_at DESC`,
    [childId]
  );

  // Math types this child's rules rule out (lib/mathRules.ts) aren't
  // rechecked either - "never" means never, and a "weekly" one already
  // served this week waits.
  const mathGate = await mathTemplateGate(childId);
  const combined: CheckupWrongItem[] = [
    ...wrongBank.map((row) => ({ kind: "bank" as const, row, answeredAt: row.answered_at })),
    ...wrongGenerated.filter((g) => mathGate.allowed(g.template_key)).map((g) => ({
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
  const avoidGenerated = await recentGeneratedTexts(childId);
  for (const item of chosen) {
    if (item.kind === "generated") {
      drafts.push(generatedDraftByKey(item.level, item.templateKey, avoidGenerated));
      mathGate.markServed(item.templateKey);
      continue;
    }
    const substitute = await pickSimilarBankQuestion(item.row, usedBankIds, childId);
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
