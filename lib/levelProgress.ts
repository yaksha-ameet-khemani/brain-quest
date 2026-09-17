import "server-only";
import { query } from "@/lib/db";
import { todayRangeUtc } from "@/lib/timezone";
import {
  BONUS_ROUNDS_PER_DAY,
  LEVEL_UNLOCK_ACCURACY_THRESHOLD,
  MAX_ROUNDS_PER_DAY,
  QUESTIONS_PER_ROUND,
  nextLevel,
  type Level,
} from "@/lib/config";

export interface LevelProgress {
  baseLevel: Level;
  baseRoundsToday: number;
  baseRoundsRequired: number;
  baseAccuracyToday: number | null; // null until at least one round is completed today
  bonusLevel: Level | null; // null if baseLevel is already the top level
  bonusUnlockedToday: boolean;
  bonusRoundsUsedToday: number;
  bonusRoundsRemaining: number;
}

/** Today's progress toward unlocking bonus rounds at the next level up - see
 * lib/config.ts for the exact rule (finish all of today's base-level rounds
 * with better than LEVEL_UNLOCK_ACCURACY_THRESHOLD accuracy). Resets with
 * the day, same as the daily round count itself. */
export async function getLevelProgress(childId: string, baseLevel: Level): Promise<LevelProgress> {
  const bonusLevel = nextLevel(baseLevel);
  const { start, end } = todayRangeUtc();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // kind = 'standard' only - review and checkup rounds are variable-length
  // and not the normal daily quota, so counting them here would corrupt
  // both "rounds done today" and the accuracy math below, which assumes
  // QUESTIONS_PER_ROUND questions per round.
  const baseRounds = await query<{ status: string; correct_count: number }>(
    "SELECT status, correct_count FROM rounds WHERE child_id = $1 AND level = $2 AND kind = 'standard' AND started_at >= $3 AND started_at < $4",
    [childId, baseLevel, startIso, endIso]
  );
  const completedBase = baseRounds.filter((r) => r.status === "completed");
  const baseRoundsToday = completedBase.length;
  const totalQuestions = baseRoundsToday * QUESTIONS_PER_ROUND;
  const totalCorrect = completedBase.reduce((sum, r) => sum + r.correct_count, 0);
  const baseAccuracyToday = totalQuestions > 0 ? totalCorrect / totalQuestions : null;

  const bonusUnlockedToday =
    bonusLevel !== null &&
    baseRoundsToday >= MAX_ROUNDS_PER_DAY &&
    (baseAccuracyToday ?? 0) > LEVEL_UNLOCK_ACCURACY_THRESHOLD;

  let bonusRoundsUsedToday = 0;
  if (bonusLevel !== null) {
    // Count every started round at the bonus level today, same policy as
    // the base daily limit - an abandoned attempt still used up a shot.
    const bonusRounds = await query<{ id: string }>(
      "SELECT id FROM rounds WHERE child_id = $1 AND level = $2 AND started_at >= $3 AND started_at < $4",
      [childId, bonusLevel, startIso, endIso]
    );
    bonusRoundsUsedToday = bonusRounds.length;
  }

  return {
    baseLevel,
    baseRoundsToday,
    baseRoundsRequired: MAX_ROUNDS_PER_DAY,
    baseAccuracyToday,
    bonusLevel,
    bonusUnlockedToday,
    bonusRoundsUsedToday,
    bonusRoundsRemaining: bonusLevel !== null ? Math.max(0, BONUS_ROUNDS_PER_DAY - bonusRoundsUsedToday) : 0,
  };
}
