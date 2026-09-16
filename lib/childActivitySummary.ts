import "server-only";
import { query } from "@/lib/db";
import { getStreaks } from "@/lib/streak";

export interface ChildActivitySummary {
  id: string;
  name: string;
  avatar: string;
  photoDataUrl: string | null;
  level: 1 | 2;
  lastLogin: string | null;
  totalAttempted: number;
  correct: number;
  wrong: number;
  totalTimeSeconds: number;
  currentDailyStreak: number;
  currentWeeklyStreak: number;
}

interface Row {
  id: string;
  name: string;
  avatar: string;
  photo_data_url: string | null;
  level: 1 | 2;
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
