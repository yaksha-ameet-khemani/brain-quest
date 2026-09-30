import "server-only";
import { query, queryOne } from "@/lib/db";
import { TZ, localDateKey } from "@/lib/timezone";
import { median } from "@/lib/format";
import { buildPeriodSkills, skillInsights, type SkillRow } from "@/lib/skillMap";
import {
  CATEGORIES,
  MIN_ATTEMPTS_FOR_WEAK_SPOT,
  PERIOD_REPORT_ANCHOR,
  PERIOD_REPORT_DAYS,
  RUSHED_ANSWER_SECONDS,
} from "@/lib/config";

// Detailed, admin-only reports over fixed 10-day periods. A finished period's
// report is built once and saved to `child_reports` as a frozen snapshot; the
// period still in progress is built live and never saved. Saved reports are
// permanent: the database rejects any delete/update of them (see
// db/migrations/015_child_reports.sql), so this file only ever INSERTs. See
// docs/blueprint.md v30 for why snapshots rather than recomputing on demand.

const DAY_MS = 86_400_000;
// Categories need at least this many answers before the report calls them a
// strength/weakness or a trend - a handful of guesses shouldn't decide it.
const MIN_CATEGORY_ATTEMPTS = 10;
const MISSED_SAMPLES_PER_CATEGORY = 6;

const CATEGORY_LABEL: Record<string, string> = { math: "Math", logic: "Logic", riddle: "Riddle", spatial: "Spatial" };

export interface Tally {
  answered: number;
  correct: number;
}

export interface CategoryReport extends Tally {
  category: string;
  wrongPicked: number;
  timedOut: number;
  rushedWrong: number; // wrong picks faster than RUSHED_ANSWER_SECONDS
  medianSeconds: number | null;
  byLevel: (Tally & { level: number })[];
  firstHalf: Tally; // first 5 days of the period
  secondHalf: Tally; // last 5 days
}

export interface PeriodReport {
  periodStart: string; // YYYY-MM-DD, APP_TIMEZONE
  periodEnd: string; // inclusive
  generatedAt: string;
  complete: boolean; // false = period still in progress, built live
  childLevel: number; // child's level when the report was built
  totals: Tally & {
    rounds: number;
    daysPlayed: number;
    wrongPicked: number;
    timedOut: number;
    paused: number;
    reviewAnswered: number; // unscored practice, included in the totals above
    medianSeconds: number | null;
  };
  categories: CategoryReport[];
  mathSkills: (Tally & { key: string; label: string })[];
  // Skill map for the period (lib/skillMap.ts). Missing from reports saved
  // before skills existed; for those, the report route computes it at view
  // time from today's tags and sets skillsComputedLater (never saved).
  skills?: SkillRow[];
  skillsComputedLater?: boolean;
  days: (Tally & { date: string; rounds: number; logins: number })[];
  missed: { category: string; level: number; text: string; seconds: number | null; timedOut: boolean }[];
  points: { opening: number; earned: number; spent: number; refunded: number; adjusted: number; closing: number };
  rewardRequests: { rewardName: string; cost: number; status: string; requestedAt: string }[];
  insights: string[];
}

export interface SavedReportSummary {
  periodStart: string;
  periodEnd: string;
  answered: number;
  correct: number;
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Start key of the 10-day period containing `key`. */
export function periodStartFor(key: string): string {
  const offset = Math.floor(daysBetween(PERIOD_REPORT_ANCHOR, key) / PERIOD_REPORT_DAYS);
  return addDays(PERIOD_REPORT_ANCHOR, offset * PERIOD_REPORT_DAYS);
}

function pct(t: Tally): number | null {
  return t.answered > 0 ? Math.round((100 * t.correct) / t.answered) : null;
}

function humanizeTemplateKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function buildPeriodReport(childId: string, periodStart: string): Promise<PeriodReport> {
  const periodEnd = addDays(periodStart, PERIOD_REPORT_DAYS - 1);
  const midpoint = addDays(periodStart, PERIOD_REPORT_DAYS / 2); // first day of the second half
  const today = localDateKey();
  const localDay = (col: string) => `to_char(${col} AT TIME ZONE $2, 'YYYY-MM-DD')`;
  const inPeriod = (col: string) => `${localDay(col)} BETWEEN $3 AND $4`;
  const args = [childId, TZ, periodStart, periodEnd];

  const child = await queryOne<{ level: number }>("SELECT level FROM children WHERE id = $1", [childId]);
  const childLevel = child?.level ?? 1;
  const [answers, rounds, logins, tx, opening, requests, skills] = await Promise.all([
    query<{
      day: string;
      level: number;
      kind: string;
      category: string;
      template_key: string | null;
      question_text: string;
      is_correct: boolean;
      selected_index: number | null;
      paused: boolean;
      seconds: string | null;
    }>(
      `SELECT ${localDay("rq.answered_at")} AS day, r.level, r.kind, rq.category, rq.template_key,
              rq.question_text, rq.is_correct, rq.selected_index, rq.paused,
              EXTRACT(EPOCH FROM rq.answered_at - rq.shown_at) AS seconds
       FROM round_questions rq JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.answered_at IS NOT NULL AND ${inPeriod("rq.answered_at")}
       ORDER BY rq.answered_at DESC`,
      args
    ),
    query<{ day: string; n: string }>(
      `SELECT ${localDay("completed_at")} AS day, COUNT(*) AS n FROM rounds
       WHERE child_id = $1 AND status = 'completed' AND ${inPeriod("completed_at")} GROUP BY 1`,
      args
    ),
    query<{ day: string; n: string }>(
      `SELECT ${localDay("logged_in_at")} AS day, COUNT(*) AS n FROM child_logins
       WHERE child_id = $1 AND ${inPeriod("logged_in_at")} GROUP BY 1`,
      args
    ),
    query<{ type: string; sum: string }>(
      `SELECT type, SUM(amount) AS sum FROM point_transactions
       WHERE child_id = $1 AND ${inPeriod("created_at")} GROUP BY 1`,
      args
    ),
    queryOne<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS sum FROM point_transactions
       WHERE child_id = $1 AND ${localDay("created_at")} < $3`,
      [childId, TZ, periodStart]
    ),
    query<{ reward_name: string; cost: number; status: string; requested_at: string }>(
      `SELECT reward_name, cost, status, requested_at FROM redemptions
       WHERE child_id = $1 AND ${inPeriod("requested_at")} ORDER BY requested_at`,
      args
    ),
    buildPeriodSkills(childId, periodStart, periodEnd, childLevel),
  ]);

  // ---- per-answer tallies ----
  const secondsOf = (a: (typeof answers)[number]) => (a.seconds === null ? null : Number(a.seconds));
  const isTimeout = (a: (typeof answers)[number]) => !a.is_correct && a.selected_index === -1;

  const categories: CategoryReport[] = CATEGORIES.map((category) => {
    const rows = answers.filter((a) => a.category === category);
    const tally = (rs: typeof rows): Tally => ({ answered: rs.length, correct: rs.filter((r) => r.is_correct).length });
    const levels = [...new Set(rows.map((r) => r.level))].sort();
    return {
      category,
      ...tally(rows),
      wrongPicked: rows.filter((r) => !r.is_correct && !isTimeout(r)).length,
      timedOut: rows.filter(isTimeout).length,
      rushedWrong: rows.filter((r) => {
        const s = secondsOf(r);
        return !r.is_correct && !isTimeout(r) && s !== null && s < RUSHED_ANSWER_SECONDS;
      }).length,
      medianSeconds: median(rows.map(secondsOf).filter((s): s is number => s !== null)),
      byLevel: levels.map((level) => ({ level, ...tally(rows.filter((r) => r.level === level)) })),
      firstHalf: tally(rows.filter((r) => r.day < midpoint)),
      secondHalf: tally(rows.filter((r) => r.day >= midpoint)),
    };
  }).filter((c) => c.answered > 0);

  const skillMap = new Map<string, Tally>();
  for (const a of answers) {
    if (!a.template_key) continue;
    const t = skillMap.get(a.template_key) ?? { answered: 0, correct: 0 };
    t.answered++;
    if (a.is_correct) t.correct++;
    skillMap.set(a.template_key, t);
  }
  const mathSkills = [...skillMap.entries()]
    .map(([key, t]) => ({ key, label: humanizeTemplateKey(key), ...t }))
    .sort((a, b) => b.answered - a.answered);

  const roundsByDay = new Map(rounds.map((r) => [r.day, Number(r.n)]));
  const loginsByDay = new Map(logins.map((l) => [l.day, Number(l.n)]));
  const days = Array.from({ length: PERIOD_REPORT_DAYS }, (_, i) => addDays(periodStart, i))
    .filter((date) => date <= today)
    .map((date) => {
      const rows = answers.filter((a) => a.day === date);
      return {
        date,
        rounds: roundsByDay.get(date) ?? 0,
        logins: loginsByDay.get(date) ?? 0,
        answered: rows.length,
        correct: rows.filter((r) => r.is_correct).length,
      };
    });

  const missed: PeriodReport["missed"] = [];
  for (const c of CATEGORIES) {
    for (const a of answers.filter((x) => x.category === c && !x.is_correct).slice(0, MISSED_SAMPLES_PER_CATEGORY)) {
      const s = secondsOf(a);
      missed.push({ category: c, level: a.level, text: a.question_text, seconds: s === null ? null : Math.round(s), timedOut: isTimeout(a) });
    }
  }

  const sumOf = (type: string) => Number(tx.find((t) => t.type === type)?.sum ?? 0);
  const openingBalance = Number(opening?.sum ?? 0);
  const points = {
    opening: openingBalance,
    earned: sumOf("earn"),
    spent: sumOf("redeem"),
    refunded: sumOf("refund"),
    adjusted: sumOf("adjustment"),
    closing: openingBalance + tx.reduce((s, t) => s + Number(t.sum), 0),
  };

  const totals: PeriodReport["totals"] = {
    answered: answers.length,
    correct: answers.filter((a) => a.is_correct).length,
    wrongPicked: answers.filter((a) => !a.is_correct && !isTimeout(a)).length,
    timedOut: answers.filter(isTimeout).length,
    paused: answers.filter((a) => a.paused).length,
    reviewAnswered: answers.filter((a) => a.kind === "review").length,
    rounds: rounds.reduce((s, r) => s + Number(r.n), 0),
    daysPlayed: new Set(answers.map((a) => a.day)).size,
    medianSeconds: median(answers.map(secondsOf).filter((s): s is number => s !== null)),
  };

  const report: PeriodReport = {
    periodStart,
    periodEnd,
    generatedAt: new Date().toISOString(),
    complete: periodEnd < today,
    childLevel,
    totals,
    categories,
    mathSkills,
    skills,
    days,
    missed,
    points,
    rewardRequests: requests.map((r) => ({
      rewardName: r.reward_name,
      cost: r.cost,
      status: r.status,
      requestedAt: new Date(r.requested_at).toISOString(),
    })),
    insights: [],
  };
  report.insights = buildInsights(report);
  return report;
}

/** Plain-English findings, only ever stated when there's enough data behind them. */
function buildInsights(r: PeriodReport): string[] {
  const out: string[] = [];
  const t = r.totals;
  if (t.answered === 0) return ["No questions answered in this period."];

  out.push(
    `Answered ${t.answered} questions in ${t.rounds} rounds on ${t.daysPlayed} of ${r.days.length} days: ` +
      `${t.correct} correct (${pct(t)}%), ${t.wrongPicked} wrong, ${t.timedOut} ran out of time.`
  );

  const ranked = r.categories.filter((c) => c.answered >= MIN_CATEGORY_ATTEMPTS).sort((a, b) => pct(b)! - pct(a)!);
  if (ranked.length >= 2) {
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    out.push(`Strongest category: ${CATEGORY_LABEL[best.category]} (${pct(best)}%). Weakest: ${CATEGORY_LABEL[worst.category]} (${pct(worst)}%).`);
  }

  for (const c of r.categories) {
    const label = CATEGORY_LABEL[c.category];
    const a = pct(c.firstHalf);
    const b = pct(c.secondHalf);
    if (c.firstHalf.answered >= MIN_CATEGORY_ATTEMPTS / 2 && c.secondHalf.answered >= MIN_CATEGORY_ATTEMPTS / 2 && a !== null && b !== null && Math.abs(b - a) >= 10) {
      out.push(`${label} ${b > a ? "improved" : "slipped"} over the period: ${a}% in the first 5 days, ${b}% in the last 5.`);
    }
    const levels = c.byLevel.filter((l) => l.answered >= MIN_ATTEMPTS_FOR_WEAK_SPOT * 2);
    if (levels.length >= 2) {
      const lo = levels[0]!;
      const hi = levels[levels.length - 1]!;
      if (pct(lo)! - pct(hi)! >= 25) {
        out.push(`${label} drops sharply from ${pct(lo)}% at Level ${lo.level} to ${pct(hi)}% at Level ${hi.level}.`);
      }
    }
    const wrong = c.wrongPicked;
    if (c.rushedWrong >= 5 && c.rushedWrong / Math.max(wrong, 1) >= 0.2) {
      out.push(
        `${label}: ${c.rushedWrong} of ${wrong} wrong answers came in under ${RUSHED_ANSWER_SECONDS} seconds - likely rushing rather than not knowing.`
      );
    }
  }

  const skills = r.mathSkills.filter((s) => s.answered >= MIN_ATTEMPTS_FOR_WEAK_SPOT);
  const weak = skills.filter((s) => pct(s)! < 50);
  const strong = skills.filter((s) => pct(s)! >= 80);
  if (weak.length) out.push(`Math skills to practise: ${weak.map((s) => `${s.label.toLowerCase()} (${s.correct}/${s.answered})`).join(", ")}.`);
  if (strong.length) out.push(`Math skills mastered: ${strong.map((s) => `${s.label.toLowerCase()} (${s.correct}/${s.answered})`).join(", ")}.`);

  if (r.skills) out.push(...skillInsights(r.skills, r.childLevel));

  if (t.timedOut >= 5) {
    const most = [...r.categories].sort((a, b) => b.timedOut - a.timedOut)[0]!;
    out.push(`Ran out of time on ${t.timedOut} questions, most often in ${CATEGORY_LABEL[most.category]} (${most.timedOut}).`);
  }
  if (r.rewardRequests.length) {
    out.push(`Requested ${r.rewardRequests.length} reward${r.rewardRequests.length === 1 ? "" : "s"} (${-r.points.spent} points).`);
  }
  return out;
}

/** Saves a frozen report for every finished period this child hasn't got one
 * for yet (skipping periods that ended before the child existed), then lists
 * all saved reports, newest first. Safe to call repeatedly/concurrently. */
export async function ensureSavedReports(childId: string): Promise<SavedReportSummary[]> {
  const child = await queryOne<{ name: string; created_day: string }>(
    `SELECT name, to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS created_day FROM children WHERE id = $1`,
    [childId, TZ]
  );
  if (!child) return [];

  const existing = new Set(
    (
      await query<{ start: string }>(
        "SELECT to_char(period_start, 'YYYY-MM-DD') AS start FROM child_reports WHERE child_id = $1",
        [childId]
      )
    ).map((r) => r.start)
  );

  const currentStart = periodStartFor(localDateKey());
  for (let start = PERIOD_REPORT_ANCHOR; start < currentStart; start = addDays(start, PERIOD_REPORT_DAYS)) {
    const end = addDays(start, PERIOD_REPORT_DAYS - 1);
    if (end < child.created_day || existing.has(start)) continue;
    const report = await buildPeriodReport(childId, start);
    await query(
      `INSERT INTO child_reports (child_id, child_name, period_start, period_end, data) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id, period_start) DO NOTHING`,
      [childId, child.name, start, end, JSON.stringify(report)]
    );
  }

  return query<SavedReportSummary>(
    `SELECT to_char(period_start, 'YYYY-MM-DD') AS "periodStart", to_char(period_end, 'YYYY-MM-DD') AS "periodEnd",
            (data->'totals'->>'answered')::int AS answered, (data->'totals'->>'correct')::int AS correct
     FROM child_reports WHERE child_id = $1 ORDER BY period_start DESC`,
    [childId]
  );
}

export async function getSavedReport(childId: string, periodStart: string): Promise<PeriodReport | null> {
  const row = await queryOne<{ data: PeriodReport }>(
    "SELECT data FROM child_reports WHERE child_id = $1 AND period_start = $2",
    [childId, periodStart]
  );
  return row?.data ?? null;
}

/** A saved report from before the skill map existed gets one computed now,
 * from its own period's answers and today's skill tags - shown, never saved
 * (saved reports can't change; see db/migrations/015_child_reports.sql). */
export async function withSkills(childId: string, report: PeriodReport): Promise<PeriodReport> {
  if (report.skills) return report;
  const skills = await buildPeriodSkills(childId, report.periodStart, report.periodEnd, report.childLevel);
  return { ...report, skills, skillsComputedLater: true };
}
