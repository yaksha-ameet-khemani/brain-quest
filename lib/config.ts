// Central place for every tunable number in the game. Changing the economy
// means changing numbers here, not hunting through route handlers.

export type Level = 1 | 2 | 3;
export const ALL_LEVELS: readonly Level[] = [1, 2, 3];

export function isValidLevel(value: unknown): value is Level {
  return typeof value === "number" && (ALL_LEVELS as readonly number[]).includes(value);
}

export const CATEGORIES = ["math", "logic", "riddle", "spatial"] as const;
export type Category = (typeof CATEGORIES)[number];
export const BANK_CATEGORIES = ["logic", "riddle", "spatial"] as const;
export type BankCategory = (typeof BANK_CATEGORIES)[number];

// Default relative weight for a category a child has no explicit setting
// for - equal odds across all four until an admin dials one up or down.
export const DEFAULT_CATEGORY_WEIGHT = 1;

export const LEVELS: Record<Level, { label: string; perQuestionSeconds: number }> = {
  1: { label: "Level 1", perQuestionSeconds: 45 },
  2: { label: "Level 2", perQuestionSeconds: 90 },
  3: { label: "Level 3", perQuestionSeconds: 100 },
};
export const MAX_LEVEL: Level = 3;

// Multi-step questions marked "pen & paper" (questions.pen_paper, or a
// generated template's penPaper) get this much time instead, unless the admin
// changes it in Game settings (game_settings.pen_paper_seconds) or the
// child's own timer is longer. See lib/questionTiming.ts.
export const PEN_PAPER_DEFAULT_SECONDS = 180;
export const PEN_PAPER_MIN_SECONDS = 30;
export const PEN_PAPER_MAX_SECONDS = 600;

/** A child's actual per-question countdown: the level default, unless an
 * admin has set a per-child override (children.answer_seconds) - see
 * app/api/admin/children/[childId]/timer/route.ts. */
export function effectiveAnswerSeconds(level: Level, answerSecondsOverride: number | null | undefined): number {
  return answerSecondsOverride ?? LEVELS[level].perQuestionSeconds;
}

// Default minimum time a kid must stay on the "here's the explanation"
// screen before the Next button unlocks - a forced reading beat so a round
// can't be blitzed through without ever looking at why an answer was right
// or wrong. Used unless an admin has set a per-child override
// (children.explain_seconds) - see effectiveExplainSeconds() below.
export const EXPLANATION_MIN_READ_SECONDS = 6;

/** A child's actual forced-read countdown on the explanation screen: the
 * default above, unless an admin has set a per-child override
 * (children.explain_seconds, 0 meaning "no forced wait") - see
 * app/api/admin/children/[childId]/timer/route.ts. */
export function effectiveExplainSeconds(explainSecondsOverride: number | null | undefined): number {
  return explainSecondsOverride ?? EXPLANATION_MIN_READ_SECONDS;
}

/** The level directly above `level`, or null if it's already the top
 * (currently always the case for level 2 - there's no level 3 content yet).
 * Adding a new top level later is: bump the Level type/MAX_LEVEL, add its
 * LEVELS/POINTS_PER_CORRECT/PERFECT_ROUND_BONUS entries, and seed its
 * question bank - this function needs no change. */
export function nextLevel(level: Level): Level | null {
  return level < MAX_LEVEL ? ((level + 1) as Level) : null;
}

export const QUESTIONS_PER_ROUND = 5;
export const MAX_ROUNDS_PER_DAY = 3;

// A child who finishes all of today's MAX_ROUNDS_PER_DAY rounds at their own
// level with better than this accuracy unlocks BONUS_ROUNDS_PER_DAY extra
// rounds at the next level up, for that day only - resets with the daily
// round count. Not a permanent level change; see docs/blueprint.md.
export const LEVEL_UNLOCK_ACCURACY_THRESHOLD = 0.75;
export const BONUS_ROUNDS_PER_DAY = 3;

// A review round replays bank questions whose most recent attempt (of any
// kind) was wrong, for practice only - never scored, never counted toward
// MAX_ROUNDS_PER_DAY. Capped at one a day so it stays a focused top-up, not
// a way to grind past the daily round limit, and at a handful of questions
// so it never turns into a full extra round in disguise.
export const REVIEW_ROUNDS_PER_DAY = 1;
export const MAX_REVIEW_QUESTIONS = 5;

// A "checkup" is a mandatory short round served instead of a child's first
// standard round of the day, whenever they have recent wrong answers to
// recheck - see lib/checkupProgress.ts. Unlike a review round it never
// replays the exact same question: bank questions are swapped for a
// different one on the same skill (falling back to the same category), and generated (math)
// questions are regenerated from the same template with new numbers. Since
// getting a genuinely different question right is real evidence of
// understanding, it IS scored normally (not free practice like review).
export const MAX_CHECKUP_QUESTIONS = 5;

// The swap-in questions review and checkup rounds serve (see
// lib/buildRound.ts's pickSimilarBankQuestion) skip anything the child was
// shown within this many hours - kids remember what they answered a day or
// two ago, and a "different" question they already know isn't a real recheck.
// Rolling window, not calendar days, so there's no gap around midnight.
export const RECENT_QUESTION_WINDOW_HOURS = 48;

// Per-child report tunables (lib/childReport.ts) - how far back each section
// looks, and how many attempts something needs before it's called a
// strength/weakness/trend at all, so one lucky or unlucky guess never skews
// the read.
export const MIN_ATTEMPTS_FOR_WEAK_SPOT = 4;
export const REPORT_CATEGORY_WINDOW_DAYS = 30;
export const REPORT_TREND_WINDOW_DAYS = 14;
export const REPORT_LEVEL_READINESS_WINDOW_DAYS = 7;

// Saved admin-only period reports (lib/periodReport.ts): fixed back-to-back
// blocks of this many days, counted from the anchor (the day the family first
// played), so every child's periods line up - 16-25 Sep, 26 Sep-5 Oct, ...
export const PERIOD_REPORT_DAYS = 10;
export const PERIOD_REPORT_ANCHOR = "2026-09-16";
// A wrong answer given faster than this is counted as a likely rushed guess.
export const RUSHED_ANSWER_SECONDS = 8;

// Admin skill map (lib/skillMap.ts): how each child is doing on each skill in
// lib/skills.ts. A skill isn't judged until it has SKILL_MIN_ANSWERS answers;
// its state is then read from the last SKILL_RECENT_ANSWERS answers, so old
// mistakes stop counting once they're outnumbered by newer answers.
export const SKILL_MAP_WINDOW_DAYS = 60;
export const SKILL_MIN_ANSWERS = 5;
export const SKILL_RECENT_ANSWERS = 10;
export const SKILL_SOLID_PCT = 75;
export const SKILL_MASTERED_PCT = 90;
// "Mastered" also needs this many DIFFERENT questions answered right, so
// remembering one answer can't count as knowing the skill.
export const SKILL_MASTERED_DISTINCT = 8;
// A weak skill with fewer active bank questions than this at the child's
// level (and no math generator behind it) is flagged "thin in bank".
export const SKILL_THIN_BANK = 20;

// Points are deliberately close across levels: a harder question should feel
// harder, not pay a wildly different daily wage. See docs/blueprint.md
// "Point Economics" for the math behind these numbers.
export const POINTS_PER_CORRECT: Record<Level, number> = {
  1: 10,
  2: 12,
  3: 14,
};

export const PERFECT_ROUND_BONUS: Record<Level, number> = {
  1: 8,
  2: 10,
  3: 12,
};

// 3 correct answers in a row (within a round) multiplies points on the
// *remaining* correct answers in that round.
export const STREAK_THRESHOLD = 3;
export const STREAK_MULTIPLIER = 1.5;

// Answering well inside the timer earns a small speed bonus - kept tiny and
// additive so a slow-but-correct kid is never punished, just rewarded extra
// for being fast too.
export const SPEED_BONUS_FRACTION_OF_TIME = 0.4; // answer within 40% of the limit
export const SPEED_BONUS_POINTS = 2;

// Sanity cap so max daily earn stays predictable even if every bonus lands:
// 3 rounds * 5 questions * (points + streak + speed) + perfect bonuses.
// Level 1 worst case ~= 3*(5*10*1.5 + 8 + 5*2) ≈ 279 -> still reasonable.

// Server-side backstop matching lib/imageResize.ts's client-side cap - the
// client should never send more than this, but never trust that alone.
export const MAX_PHOTO_DATA_URL_LENGTH = 350_000;

export const DEFAULT_REWARDS: { name: string; cost: number; emoji: string }[] = [
  { name: "Small snack or ice cream", cost: 50, emoji: "🍦" },
  { name: "30 minutes extra screen time", cost: 50, emoji: "📺" },
  { name: "Pick tonight's dinner", cost: 80, emoji: "🍽️" },
  { name: "Outing to the park or playground", cost: 150, emoji: "🛝" },
  { name: "Movie night pick", cost: 150, emoji: "🎬" },
  { name: "A favourite toy or small game", cost: 500, emoji: "🎁" },
  { name: "Special day outing", cost: 500, emoji: "🎉" },
];
