// Central place for every tunable number in the game. Changing the economy
// means changing numbers here, not hunting through route handlers.

export type Level = 1 | 2;

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
};

export const QUESTIONS_PER_ROUND = 5;
export const MAX_ROUNDS_PER_DAY = 3;

// Points are deliberately close across levels: a harder question should feel
// harder, not pay a wildly different daily wage. See docs/blueprint.md
// "Point Economics" for the math behind these numbers.
export const POINTS_PER_CORRECT: Record<Level, number> = {
  1: 10,
  2: 12,
};

export const PERFECT_ROUND_BONUS: Record<Level, number> = {
  1: 8,
  2: 10,
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

export const DEFAULT_REWARDS: { name: string; cost: number; emoji: string }[] = [
  { name: "Small snack or ice cream", cost: 50, emoji: "🍦" },
  { name: "30 minutes extra screen time", cost: 50, emoji: "📺" },
  { name: "Pick tonight's dinner", cost: 80, emoji: "🍽️" },
  { name: "Outing to the park or playground", cost: 150, emoji: "🛝" },
  { name: "Movie night pick", cost: 150, emoji: "🎬" },
  { name: "A favourite toy or small game", cost: 500, emoji: "🎁" },
  { name: "Special day outing", cost: 500, emoji: "🎉" },
];
