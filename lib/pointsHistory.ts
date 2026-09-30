import "server-only";
import { query, queryOne } from "@/lib/db";
import { TZ, localDateKey } from "@/lib/timezone";

const HISTORY_DAYS = 30;

export interface RewardRequest {
  rewardName: string;
  cost: number;
  status: "pending" | "approved" | "denied" | "fulfilled";
  requestedAt: string;
}

export interface HistoryDay {
  date: string; // YYYY-MM-DD in APP_TIMEZONE
  earned: number;
  redeemed: number; // negative or 0
  refunded: number;
  adjusted: number; // signed (e.g. negative marking)
  closingBalance: number;
  roundsCompleted: number;
  answered: number;
  correct: number;
  logins: string[]; // ISO instants, oldest first
  requests: RewardRequest[];
}

export interface PointsHistory {
  openingBalance: number; // balance before the first day shown
  days: HistoryDay[]; // newest first
}

/** YYYY-MM-DD keys for the last `n` local days, oldest first, ending today. */
function lastDayKeys(n: number): string[] {
  const today = localDateKey();
  const base = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10)
  );
}

/** One row per local calendar day for the last 30 days (including days with
 * no activity), with the balance at the end of each day derived from the
 * ledger - so it's clear exactly where points came from and went. Shared by
 * the admin view (any child) and the kid's own history page. */
export async function getPointsHistory(childId: string): Promise<PointsHistory> {
  const days = lastDayKeys(HISTORY_DAYS);
  const first = days[0];
  const localDay = (col: string) => `to_char(${col} AT TIME ZONE $2, 'YYYY-MM-DD')`;

  const [opening, tx, rounds, answers, logins, requests] = await Promise.all([
    queryOne<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS sum FROM point_transactions
       WHERE child_id = $1 AND ${localDay("created_at")} < $3`,
      [childId, TZ, first]
    ),
    query<{ day: string; type: string; sum: string }>(
      `SELECT ${localDay("created_at")} AS day, type, SUM(amount) AS sum FROM point_transactions
       WHERE child_id = $1 AND ${localDay("created_at")} >= $3 GROUP BY 1, 2`,
      [childId, TZ, first]
    ),
    query<{ day: string; n: string }>(
      `SELECT ${localDay("completed_at")} AS day, COUNT(*) AS n FROM rounds
       WHERE child_id = $1 AND status = 'completed' AND kind <> 'practice' AND ${localDay("completed_at")} >= $3 GROUP BY 1`,
      [childId, TZ, first]
    ),
    query<{ day: string; answered: string; correct: string }>(
      `SELECT ${localDay("rq.answered_at")} AS day, COUNT(*) AS answered,
              COUNT(*) FILTER (WHERE rq.is_correct) AS correct
       FROM round_questions rq JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND r.kind <> 'practice' AND rq.answered_at IS NOT NULL AND ${localDay("rq.answered_at")} >= $3
       GROUP BY 1`,
      [childId, TZ, first]
    ),
    query<{ day: string; logged_in_at: string }>(
      `SELECT ${localDay("logged_in_at")} AS day, logged_in_at FROM child_logins
       WHERE child_id = $1 AND ${localDay("logged_in_at")} >= $3 ORDER BY logged_in_at`,
      [childId, TZ, first]
    ),
    query<{ day: string; reward_name: string; cost: number; status: RewardRequest["status"]; requested_at: string }>(
      `SELECT ${localDay("requested_at")} AS day, reward_name, cost, status, requested_at FROM redemptions
       WHERE child_id = $1 AND ${localDay("requested_at")} >= $3 ORDER BY requested_at`,
      [childId, TZ, first]
    ),
  ]);

  const byDay = new Map<string, HistoryDay>(
    days.map((date) => [
      date,
      { date, earned: 0, redeemed: 0, refunded: 0, adjusted: 0, closingBalance: 0, roundsCompleted: 0, answered: 0, correct: 0, logins: [], requests: [] },
    ])
  );

  for (const t of tx) {
    const d = byDay.get(t.day);
    if (!d) continue;
    const amount = Number(t.sum);
    if (t.type === "earn") d.earned += amount;
    else if (t.type === "redeem") d.redeemed += amount;
    else if (t.type === "refund") d.refunded += amount;
    else d.adjusted += amount;
  }
  for (const r of rounds) {
    const d = byDay.get(r.day);
    if (d) d.roundsCompleted = Number(r.n);
  }
  for (const a of answers) {
    const d = byDay.get(a.day);
    if (d) {
      d.answered = Number(a.answered);
      d.correct = Number(a.correct);
    }
  }
  for (const l of logins) {
    byDay.get(l.day)?.logins.push(new Date(l.logged_in_at).toISOString());
  }
  for (const r of requests) {
    byDay.get(r.day)?.requests.push({
      rewardName: r.reward_name,
      cost: r.cost,
      status: r.status,
      requestedAt: new Date(r.requested_at).toISOString(),
    });
  }

  let balance = Number(opening?.sum ?? 0);
  const openingBalance = balance;
  const history = days.map((date) => {
    const d = byDay.get(date)!;
    balance += d.earned + d.redeemed + d.refunded + d.adjusted;
    d.closingBalance = balance;
    return d;
  });

  // Newest first, matching the other lists on the admin child page.
  return { openingBalance, days: history.reverse() };
}
