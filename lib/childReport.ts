import "server-only";
import { query, queryOne } from "@/lib/db";
import { localDateKey } from "@/lib/timezone";
import { getStreaks } from "@/lib/streak";
import { getCheckupProgress } from "@/lib/checkupProgress";
import {
  LEVEL_UNLOCK_ACCURACY_THRESHOLD,
  MAX_ROUNDS_PER_DAY,
  MIN_ATTEMPTS_FOR_WEAK_SPOT,
  QUESTIONS_PER_ROUND,
  REPORT_CATEGORY_WINDOW_DAYS,
  REPORT_LEVEL_READINESS_WINDOW_DAYS,
  REPORT_TREND_WINDOW_DAYS,
  nextLevel,
  type Level,
} from "@/lib/config";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_LABEL: Record<string, string> = {
  math: "Math",
  logic: "Logic",
  riddle: "Riddle",
  spatial: "Spatial",
};

export interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  accuracy: number | null;
}

export interface TrendStat {
  category: string;
  recentAccuracy: number | null;
  priorAccuracy: number | null;
  recentAttempts: number;
  priorAttempts: number;
  direction: "up" | "down" | "flat" | "insufficient-data";
}

export interface WeakSpot {
  kind: "concept" | "math-skill";
  label: string;
  category: string;
  accuracy: number;
  attempts: number;
}

export interface LevelReadiness {
  atTopLevel: boolean;
  daysConsidered: number;
  bonusUnlockedDays: number;
  ready: boolean;
  note: string | null;
}

export interface ChildReport {
  summary: string;
  hasEnoughData: boolean;
  snapshot: {
    questionsAnswered: number;
    roundsCompleted: number;
    overallAccuracy: number | null;
    avgSecondsPerQuestion: number | null;
    currentDailyStreak: number;
    currentWeeklyStreak: number;
  };
  categoryBreakdown: CategoryStat[]; // last REPORT_CATEGORY_WINDOW_DAYS days
  trend: TrendStat[]; // last REPORT_TREND_WINDOW_DAYS days vs. the same length before that
  weakSpots: WeakSpot[]; // specific bank concepts / math skills, lifetime
  pendingRecheckCount: number; // from lib/checkupProgress.ts - how many of those are already queued for a checkup
  levelReadiness: LevelReadiness;
}

function accuracyOf(correct: number, total: number): number | null {
  return total > 0 ? correct / total : null;
}

function humanizeTemplateKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

/** Builds one child's parent-facing report: a plain-English summary plus
 * the structured data behind it (category strengths/weaknesses, trend,
 * specific weak spots, and a level-readiness nudge). Everything here is
 * derived from round_questions/rounds that already exist - no schema
 * changes, and nothing fails hard if a child has little/no history yet
 * (see `hasEnoughData`). */
export async function getChildReport(childId: string, level: Level): Promise<ChildReport> {
  const [answeredRows, roundsCompletedRow, streaks, checkupProgress, conceptRows, templateRows] = await Promise.all([
    query<{ category: string; is_correct: boolean; answered_at: string; duration_seconds: string | null }>(
      `SELECT rq.category, rq.is_correct, rq.answered_at,
              EXTRACT(EPOCH FROM (rq.answered_at - rq.shown_at)) AS duration_seconds
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.is_correct IS NOT NULL`,
      [childId]
    ),
    queryOne<{ count: string }>("SELECT count(*) FROM rounds WHERE child_id = $1 AND status = 'completed'", [
      childId,
    ]),
    getStreaks(childId),
    getCheckupProgress(childId),
    query<{ concept: string; category: string; is_correct: boolean }>(
      `SELECT q.concept, q.category, rq.is_correct
       FROM round_questions rq
       JOIN questions q ON q.id = rq.question_id
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'bank' AND q.concept IS NOT NULL AND rq.is_correct IS NOT NULL`,
      [childId]
    ),
    query<{ template_key: string; is_correct: boolean }>(
      `SELECT rq.template_key, rq.is_correct
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'generated' AND rq.template_key IS NOT NULL AND rq.is_correct IS NOT NULL`,
      [childId]
    ),
  ]);

  const questionsAnswered = answeredRows.length;
  const overallCorrect = answeredRows.filter((r) => r.is_correct).length;
  const overallAccuracy = accuracyOf(overallCorrect, questionsAnswered);
  const durations = answeredRows
    .map((r) => Number(r.duration_seconds))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgSecondsPerQuestion =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const now = Date.now();
  const categoryWindowStart = now - REPORT_CATEGORY_WINDOW_DAYS * DAY_MS;
  const trendRecentStart = now - REPORT_TREND_WINDOW_DAYS * DAY_MS;
  const trendPriorStart = now - 2 * REPORT_TREND_WINDOW_DAYS * DAY_MS;

  // Category breakdown - last REPORT_CATEGORY_WINDOW_DAYS days, since recent
  // performance is what actually tells you what to work on now, not a
  // lifetime average that a rough week from months ago still drags down.
  const categoryTotals = new Map<string, { correct: number; total: number }>();
  for (const row of answeredRows) {
    if (new Date(row.answered_at).getTime() < categoryWindowStart) continue;
    const entry = categoryTotals.get(row.category) ?? { correct: 0, total: 0 };
    entry.total++;
    if (row.is_correct) entry.correct++;
    categoryTotals.set(row.category, entry);
  }
  const categoryBreakdown: CategoryStat[] = Array.from(categoryTotals.entries())
    .map(([category, { correct, total }]) => ({ category, correct, total, accuracy: accuracyOf(correct, total) }))
    .sort((a, b) => b.total - a.total);

  // Trend - recent REPORT_TREND_WINDOW_DAYS days vs. the same-length window
  // right before that, per category and combined (the combined figure feeds
  // the summary sentence below).
  const recentByCategory = new Map<string, { correct: number; total: number }>();
  const priorByCategory = new Map<string, { correct: number; total: number }>();
  const overallRecent = { correct: 0, total: 0 };
  const overallPrior = { correct: 0, total: 0 };
  for (const row of answeredRows) {
    const t = new Date(row.answered_at).getTime();
    if (t >= trendRecentStart) {
      const e = recentByCategory.get(row.category) ?? { correct: 0, total: 0 };
      e.total++;
      if (row.is_correct) e.correct++;
      recentByCategory.set(row.category, e);
      overallRecent.total++;
      if (row.is_correct) overallRecent.correct++;
    } else if (t >= trendPriorStart) {
      const e = priorByCategory.get(row.category) ?? { correct: 0, total: 0 };
      e.total++;
      if (row.is_correct) e.correct++;
      priorByCategory.set(row.category, e);
      overallPrior.total++;
      if (row.is_correct) overallPrior.correct++;
    }
  }
  const trendCategories = new Set([...recentByCategory.keys(), ...priorByCategory.keys()]);
  const trend: TrendStat[] = Array.from(trendCategories)
    .map((category) => {
      const recent = recentByCategory.get(category) ?? { correct: 0, total: 0 };
      const prior = priorByCategory.get(category) ?? { correct: 0, total: 0 };
      const recentAccuracy = accuracyOf(recent.correct, recent.total);
      const priorAccuracy = accuracyOf(prior.correct, prior.total);
      let direction: TrendStat["direction"] = "insufficient-data";
      if (
        recentAccuracy !== null &&
        priorAccuracy !== null &&
        recent.total >= MIN_ATTEMPTS_FOR_WEAK_SPOT &&
        prior.total >= MIN_ATTEMPTS_FOR_WEAK_SPOT
      ) {
        const diff = recentAccuracy - priorAccuracy;
        direction = diff > 0.05 ? "up" : diff < -0.05 ? "down" : "flat";
      }
      return {
        category,
        recentAccuracy,
        priorAccuracy,
        recentAttempts: recent.total,
        priorAttempts: prior.total,
        direction,
      };
    })
    .sort((a, b) => (CATEGORY_LABEL[a.category] ?? a.category).localeCompare(CATEGORY_LABEL[b.category] ?? b.category));

  const overallRecentAccuracy = accuracyOf(overallRecent.correct, overallRecent.total);
  const overallPriorAccuracy = accuracyOf(overallPrior.correct, overallPrior.total);

  // Weak spots - specific bank concepts (admin-tagged, see the daily
  // checkup feature) and math skills (generator template), lifetime, with a
  // minimum attempt count so one unlucky guess never gets flagged, and only
  // ones that are genuinely weak (below 75%), not just "not perfect".
  const conceptTotals = new Map<string, { category: string; correct: number; total: number }>();
  for (const row of conceptRows) {
    const e = conceptTotals.get(row.concept) ?? { category: row.category, correct: 0, total: 0 };
    e.total++;
    if (row.is_correct) e.correct++;
    conceptTotals.set(row.concept, e);
  }
  const templateTotals = new Map<string, { correct: number; total: number }>();
  for (const row of templateRows) {
    const e = templateTotals.get(row.template_key) ?? { correct: 0, total: 0 };
    e.total++;
    if (row.is_correct) e.correct++;
    templateTotals.set(row.template_key, e);
  }
  const weakSpots: WeakSpot[] = [
    ...Array.from(conceptTotals.entries())
      .filter(([, s]) => s.total >= MIN_ATTEMPTS_FOR_WEAK_SPOT)
      .map(([concept, s]) => ({
        kind: "concept" as const,
        label: concept,
        category: s.category,
        accuracy: s.correct / s.total,
        attempts: s.total,
      })),
    ...Array.from(templateTotals.entries())
      .filter(([, s]) => s.total >= MIN_ATTEMPTS_FOR_WEAK_SPOT)
      .map(([key, s]) => ({
        kind: "math-skill" as const,
        label: humanizeTemplateKey(key),
        category: "math",
        accuracy: s.correct / s.total,
        attempts: s.total,
      })),
  ]
    .filter((w) => w.accuracy < 0.75)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // Level readiness - of the last REPORT_LEVEL_READINESS_WINDOW_DAYS days
  // this child actually played at their base level, how many did they
  // unlock the bonus round on (same rule as lib/levelProgress.ts, just
  // looked at across several days instead of just today)?
  const bonusLevel = nextLevel(level);
  let levelReadiness: LevelReadiness;
  if (bonusLevel === null) {
    levelReadiness = { atTopLevel: true, daysConsidered: 0, bonusUnlockedDays: 0, ready: false, note: null };
  } else {
    const windowStart = new Date(now - REPORT_LEVEL_READINESS_WINDOW_DAYS * DAY_MS).toISOString();
    const recentRounds = await query<{ started_at: string; status: string; correct_count: number }>(
      `SELECT started_at, status, correct_count FROM rounds
       WHERE child_id = $1 AND kind = 'standard' AND level = $2 AND started_at >= $3`,
      [childId, level, windowStart]
    );
    const byDay = new Map<string, { completed: number; correct: number }>();
    for (const r of recentRounds) {
      if (r.status !== "completed") continue;
      const key = localDateKey(new Date(r.started_at));
      const e = byDay.get(key) ?? { completed: 0, correct: 0 };
      e.completed++;
      e.correct += r.correct_count;
      byDay.set(key, e);
    }
    const daysConsidered = byDay.size;
    let bonusUnlockedDays = 0;
    for (const { completed, correct } of byDay.values()) {
      const totalQuestions = completed * QUESTIONS_PER_ROUND;
      const accuracy = totalQuestions > 0 ? correct / totalQuestions : 0;
      if (completed >= MAX_ROUNDS_PER_DAY && accuracy > LEVEL_UNLOCK_ACCURACY_THRESHOLD) bonusUnlockedDays++;
    }
    const ready = daysConsidered >= 3 && bonusUnlockedDays / daysConsidered >= 0.7;
    levelReadiness = {
      atTopLevel: false,
      daysConsidered,
      bonusUnlockedDays,
      ready,
      note: ready
        ? `Unlocked the Level ${bonusLevel} bonus round ${bonusUnlockedDays} of the last ${daysConsidered} days played - might be ready to move up a level.`
        : null,
    };
  }

  const hasEnoughData = questionsAnswered >= MIN_ATTEMPTS_FOR_WEAK_SPOT + 1;

  const summary = hasEnoughData
    ? buildSummary({
        questionsAnswered,
        overallAccuracy,
        categoryBreakdown,
        weakSpots,
        overallRecentAccuracy,
        overallPriorAccuracy,
        overallRecentAttempts: overallRecent.total,
        overallPriorAttempts: overallPrior.total,
      })
    : "Not enough rounds played yet to build a meaningful report - check back after a few more rounds.";

  return {
    summary,
    hasEnoughData,
    snapshot: {
      questionsAnswered,
      roundsCompleted: Number(roundsCompletedRow?.count ?? 0),
      overallAccuracy,
      avgSecondsPerQuestion,
      currentDailyStreak: streaks.currentDailyStreak,
      currentWeeklyStreak: streaks.currentWeeklyStreak,
    },
    categoryBreakdown,
    trend,
    weakSpots,
    pendingRecheckCount: checkupProgress.pendingCount,
    levelReadiness,
  };
}

function buildSummary(input: {
  questionsAnswered: number;
  overallAccuracy: number | null;
  categoryBreakdown: CategoryStat[];
  weakSpots: WeakSpot[];
  overallRecentAccuracy: number | null;
  overallPriorAccuracy: number | null;
  overallRecentAttempts: number;
  overallPriorAttempts: number;
}): string {
  const parts: string[] = [];
  const accPct = Math.round((input.overallAccuracy ?? 0) * 100);
  const quality =
    accPct >= 85 ? "great" : accPct >= 70 ? "well" : accPct >= 50 ? "okay, with room to grow" : "still building confidence";
  parts.push(`Doing ${quality} overall (${accPct}% correct across ${input.questionsAnswered} questions).`);

  const withEnoughAttempts = input.categoryBreakdown.filter(
    (c) => c.total >= MIN_ATTEMPTS_FOR_WEAK_SPOT && c.accuracy !== null
  );
  if (withEnoughAttempts.length > 0) {
    const strongest = [...withEnoughAttempts].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0]!;
    const weakest = [...withEnoughAttempts].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0]!;
    parts.push(`Strongest in ${CATEGORY_LABEL[strongest.category] ?? strongest.category} (${pct(strongest.accuracy)}).`);
    if (weakest.category !== strongest.category) {
      const weakSpotForCategory = input.weakSpots.find((w) => w.category === weakest.category);
      parts.push(
        `Could use more practice in ${CATEGORY_LABEL[weakest.category] ?? weakest.category} (${pct(weakest.accuracy)})` +
          (weakSpotForCategory ? ` - especially "${weakSpotForCategory.label}" questions.` : ".")
      );
    }
  }

  if (
    input.overallRecentAccuracy !== null &&
    input.overallPriorAccuracy !== null &&
    input.overallRecentAttempts >= MIN_ATTEMPTS_FOR_WEAK_SPOT &&
    input.overallPriorAttempts >= MIN_ATTEMPTS_FOR_WEAK_SPOT
  ) {
    const diff = Math.round((input.overallRecentAccuracy - input.overallPriorAccuracy) * 100);
    if (diff >= 5) {
      parts.push(`Accuracy is up ${diff}% compared to the ${REPORT_TREND_WINDOW_DAYS} days before that.`);
    } else if (diff <= -5) {
      parts.push(
        `Accuracy has dipped ${Math.abs(diff)}% compared to the ${REPORT_TREND_WINDOW_DAYS} days before that - worth keeping an eye on.`
      );
    }
  }

  return parts.join(" ");
}
