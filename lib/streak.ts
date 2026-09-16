import "server-only";
import { query } from "@/lib/db";
import { localDateKey } from "@/lib/timezone";

export interface StreakInfo {
  currentDailyStreak: number; // consecutive calendar days played, up through today or yesterday - 0 if broken
  longestDailyStreak: number;
  currentWeeklyStreak: number; // consecutive Sun-Sat weeks with at least one day played
  longestWeeklyStreak: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isNextDay(prevKey: string, key: string): boolean {
  return new Date(`${key}T00:00:00Z`).getTime() - new Date(`${prevKey}T00:00:00Z`).getTime() === DAY_MS;
}

function weekStartKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back up to that week's Sunday
  return d.toISOString().slice(0, 10);
}

function isNextWeek(prevKey: string, key: string): boolean {
  return new Date(`${key}T00:00:00Z`).getTime() - new Date(`${prevKey}T00:00:00Z`).getTime() === 7 * DAY_MS;
}

/** Longest run, and current (still-alive) run, through a sorted list of
 * unique keys where `isNext(a, b)` says b directly follows a. "Still alive"
 * means the run reaches all the way to the most recent unit (today/this
 * week) or the one just before it - a streak doesn't break until a full
 * unit is skipped entirely, so playing again tomorrow can still continue
 * today's streak. */
function computeRuns(
  sortedKeys: string[],
  isNext: (a: string, b: string) => boolean,
  currentKey: string,
  previousKey: string
): { current: number; longest: number } {
  if (sortedKeys.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedKeys.length; i++) {
    run = isNext(sortedKeys[i - 1]!, sortedKeys[i]!) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const lastKey = sortedKeys[sortedKeys.length - 1]!;
  if (lastKey !== currentKey && lastKey !== previousKey) return { current: 0, longest };

  let current = 1;
  for (let i = sortedKeys.length - 1; i > 0; i--) {
    if (isNext(sortedKeys[i - 1]!, sortedKeys[i]!)) current++;
    else break;
  }
  return { current, longest };
}

/** Daily and weekly play streaks for a child, computed from completed
 * rounds of any kind (standard, bonus-level, or review - showing up and
 * playing at all is the point, not which mode). Mirrors the app's other
 * day-boundary logic (lib/timezone.ts's localDateKey) rather than a raw UTC
 * calendar day, so a streak lines up with the family's actual day. */
export async function getStreaks(childId: string): Promise<StreakInfo> {
  const rows = await query<{ started_at: string }>(
    "SELECT started_at FROM rounds WHERE child_id = $1 AND status = 'completed' ORDER BY started_at ASC",
    [childId]
  );
  const dayKeys = Array.from(new Set(rows.map((r) => localDateKey(new Date(r.started_at))))).sort();

  const todayKey = localDateKey();
  const yesterdayKey = localDateKey(new Date(Date.now() - DAY_MS));
  const daily = computeRuns(dayKeys, isNextDay, todayKey, yesterdayKey);

  const weekKeys = Array.from(new Set(dayKeys.map(weekStartKey))).sort();
  const thisWeekKey = weekStartKey(todayKey);
  const lastWeekKey = weekStartKey(localDateKey(new Date(Date.now() - 7 * DAY_MS)));
  const weekly = computeRuns(weekKeys, isNextWeek, thisWeekKey, lastWeekKey);

  return {
    currentDailyStreak: daily.current,
    longestDailyStreak: daily.longest,
    currentWeeklyStreak: weekly.current,
    longestWeeklyStreak: weekly.longest,
  };
}
