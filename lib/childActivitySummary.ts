import "server-only";
import { query } from "@/lib/db";
import { getStreaks } from "@/lib/streak";
import type { Level } from "@/lib/config";

export interface ChildActivitySummary {
  id: string;
  name: string;
  avatar: string;
  photoDataUrl: string | null;
  level: Level;
  lastLogin: string | null;
  /** Up to RECENT_LOGIN_COUNT most recent login instants, newest first. */
  recentLogins: string[];
  totalAttempted: number;
  correct: number;
  wrong: number;
  totalTimeSeconds: number;
  currentDailyStreak: number;
  currentWeeklyStreak: number;
}

const RECENT_LOGIN_COUNT = 10;

interface Row {
  id: string;
  name: string;
  avatar: string;
  photo_data_url: string | null;
  level: Level;
  last_login: string | null;
  total_attempted: string;
  correct: string;
  wrong: string;
  total_time_seconds: string;
}

/** Aggregate activity summary per child - last login, attempted/correct/
 * wrong counts, total time spent answering questions. This used to be
 * public (no login) at the user's request, then reversed at the user's own
 * request once real family data was in it - seeing every kid's stats
 * side-by-side read too much like a sibling leaderboard. Now admin-only;
 * see app/api/admin/activity and docs/blueprint.md. */
export async function getChildActivitySummary(): Promise<ChildActivitySummary[]> {
  const rows = await query<Row>(`
    SELECT
      c.id, c.name, c.avatar, c.photo_data_url, c.level,
      (SELECT max(logged_in_at) FROM child_logins cl WHERE cl.child_id = c.id) AS last_login,
      COALESCE(stats.total_attempted, 0) AS total_attempted,
      COALESCE(stats.correct, 0) AS correct,
      COALESCE(stats.wrong, 0) AS wrong,
      COALESCE(stats.total_time_seconds, 0) AS total_time_seconds
    FROM children c
    LEFT JOIN (
      SELECT
        r.child_id,
        count(*) FILTER (WHERE rq.answered_at IS NOT NULL) AS total_attempted,
        count(*) FILTER (WHERE rq.is_correct = true) AS correct,
        count(*) FILTER (WHERE rq.is_correct = false) AS wrong,
        COALESCE(
          SUM(EXTRACT(EPOCH FROM (rq.answered_at - rq.shown_at)))
            FILTER (WHERE rq.answered_at IS NOT NULL AND rq.shown_at IS NOT NULL),
          0
        ) AS total_time_seconds
      FROM round_questions rq
      JOIN rounds r ON r.id = rq.round_id
      GROUP BY r.child_id
    ) stats ON stats.child_id = c.id
    ORDER BY c.created_at ASC
  `);

  const loginRows = await query<{ child_id: string; logged_in_at: string }>(
    `SELECT child_id, logged_in_at FROM (
       SELECT child_id, logged_in_at,
              row_number() OVER (PARTITION BY child_id ORDER BY logged_in_at DESC) AS rn
       FROM child_logins
     ) t
     WHERE rn <= $1
     ORDER BY child_id, logged_in_at DESC`,
    [RECENT_LOGIN_COUNT]
  );
  const loginsByChild = new Map<string, string[]>();
  for (const l of loginRows) {
    const list = loginsByChild.get(l.child_id) ?? [];
    list.push(new Date(l.logged_in_at).toISOString());
    loginsByChild.set(l.child_id, list);
  }

  return Promise.all(
    rows.map(async (r) => {
      const streaks = await getStreaks(r.id);
      return {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        photoDataUrl: r.photo_data_url,
        level: r.level,
        lastLogin: r.last_login,
        recentLogins: loginsByChild.get(r.id) ?? [],
        totalAttempted: Number(r.total_attempted),
        correct: Number(r.correct),
        wrong: Number(r.wrong),
        totalTimeSeconds: Math.round(Number(r.total_time_seconds)),
        currentDailyStreak: streaks.currentDailyStreak,
        currentWeeklyStreak: streaks.currentWeeklyStreak,
      };
    })
  );
}
