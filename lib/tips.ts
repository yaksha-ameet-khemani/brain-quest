import "server-only";
import { query, queryOne } from "@/lib/db";
import { TZ, addDays, daysBetween, localDateKey } from "@/lib/timezone";
import { skillOf } from "@/lib/skillMap";
import { loadSkills } from "@/lib/loadSkills";
import { RUSHED_ANSWER_SECONDS, TIP_PERIOD_ANCHOR, TIP_PERIOD_DAYS } from "@/lib/config";
import { HABIT_TIPS, SKILL_TIPS, type Tip } from "@/lib/tipLibrary";

// Tips from wrong answers, every fixed 3-day period (16-18 Sep, 19-21 Sep,
// ...). For each finished period, a child's wrong answers - every round
// kind, practice included - are grouped by skill, and the skills with the
// most wrong answers get a tip from lib/tipLibrary.ts, plus a habit tip when
// the mistakes show rushing or running out of time. The child sees only the
// encouraging tips; their parent and the admin also see why (how many wrong,
// and the actual mistakes). Each period is saved once to child_tips and is
// permanent - the database refuses to delete or change it (see
// db/migrations/021_child_tips.sql) - so this file only ever INSERTs.
// Deliberately separate from the reports: nothing there reads tips.

const SKILL_TIPS_SAVED = 3; // skills with a tip, per period, for parents/admin
const EXAMPLES_PER_SKILL = 3;
const RUSHING_MIN = 3; // rushed wrong answers needed, and at least half of all wrong ones
const TIMEOUTS_MIN = 2;

export interface TipExample {
  question: string;
  picked: string | null; // null = time ran out
  correct: string;
  seconds: number | null;
  practice: boolean;
}

export interface SkillTip {
  skill: string;
  skillName: string;
  wrongCount: number;
  examples: TipExample[];
  tip: Tip;
  shownToChild: boolean;
}

export interface HabitTip {
  kind: "rushing" | "timeouts";
  count: number;
  tip: Tip;
  shownToChild: boolean;
}

export interface TipSet {
  periodStart: string;
  periodEnd: string;
  answered: number;
  wrong: number;
  status: "no_answers" | "no_wrong" | "tips";
  childTips: Tip[]; // exactly what the child is shown
  skillTips: SkillTip[];
  habit: HabitTip | null;
}

/** Start day of the 3-day tip period containing `key`. */
export function tipPeriodStartFor(key: string): string {
  const offset = Math.floor(daysBetween(TIP_PERIOD_ANCHOR, key) / TIP_PERIOD_DAYS);
  return addDays(TIP_PERIOD_ANCHOR, offset * TIP_PERIOD_DAYS);
}

/** Builds one period's tips. `timesUsed` counts how often each skill has
 * already had a tip, so its tips are used in turn. */
async function buildTipSet(
  childId: string,
  periodStart: string,
  timesUsed: Map<string, number>,
  skillNames: Map<string, string>
): Promise<TipSet> {
  const periodEnd = addDays(periodStart, TIP_PERIOD_DAYS - 1);
  const rows = await query<{
    is_correct: boolean;
    question_text: string;
    options: string[];
    selected_index: number | null;
    correct_index: number;
    paused: boolean;
    template_key: string | null;
    skill_key: string | null;
    kind: string;
    seconds: string | null;
  }>(
    `SELECT rq.is_correct, rq.question_text, rq.options, rq.selected_index, rq.correct_index, rq.paused,
            rq.template_key, q.skill_key, r.kind,
            EXTRACT(EPOCH FROM rq.answered_at - rq.shown_at) AS seconds
     FROM round_questions rq
     JOIN rounds r ON r.id = rq.round_id
     LEFT JOIN questions q ON q.id = rq.question_id
     WHERE r.child_id = $1 AND rq.answered_at IS NOT NULL
       AND to_char(rq.answered_at AT TIME ZONE $2, 'YYYY-MM-DD') BETWEEN $3 AND $4
     ORDER BY rq.answered_at DESC`,
    [childId, TZ, periodStart, periodEnd]
  );

  const wrong = rows.filter((r) => r.is_correct === false);
  const base = { periodStart, periodEnd, answered: rows.length, wrong: wrong.length };
  if (rows.length === 0) return { ...base, status: "no_answers", childTips: [], skillTips: [], habit: null };
  if (wrong.length === 0) return { ...base, status: "no_wrong", childTips: [], skillTips: [], habit: null };

  // Group wrong answers by skill. Rows are newest first, so a skill's first
  // appearance is its most recent mistake - used to break ties.
  const bySkill = new Map<string, { count: number; firstSeen: number; examples: TipExample[] }>();
  wrong.forEach((r, i) => {
    const skill = skillOf(r.skill_key, r.template_key);
    if (!skill || !SKILL_TIPS[skill]) return;
    const entry = bySkill.get(skill) ?? { count: 0, firstSeen: i, examples: [] };
    entry.count++;
    if (entry.examples.length < EXAMPLES_PER_SKILL) {
      entry.examples.push({
        question: r.question_text,
        picked: r.selected_index !== null && r.selected_index >= 0 ? (r.options[r.selected_index] ?? null) : null,
        correct: r.options[r.correct_index] ?? "",
        seconds: r.seconds === null ? null : Math.round(Number(r.seconds)),
        practice: r.kind === "practice",
      });
    }
    bySkill.set(skill, entry);
  });

  const top = [...bySkill.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].firstSeen - b[1].firstSeen)
    .slice(0, SKILL_TIPS_SAVED);

  const skillTips: SkillTip[] = top.map(([skill, entry]) => {
    const tips = SKILL_TIPS[skill]!;
    const used = timesUsed.get(skill) ?? 0;
    timesUsed.set(skill, used + 1);
    return {
      skill,
      skillName: skillNames.get(skill) ?? skill,
      wrongCount: entry.count,
      examples: entry.examples,
      tip: tips[used % tips.length]!,
      shownToChild: false,
    };
  });

  // Habits: rushed = a wrong answer given fast without pausing (a timeout or a
  // paused question isn't rushing); timeouts = the clock ran out.
  const rushed = wrong.filter(
    (r) => !r.paused && r.selected_index !== null && r.selected_index >= 0 && r.seconds !== null && Number(r.seconds) < RUSHED_ANSWER_SECONDS
  ).length;
  const timeouts = wrong.filter((r) => r.selected_index === -1).length;
  let habit: HabitTip | null = null;
  if (rushed >= RUSHING_MIN && rushed * 2 >= wrong.length) {
    habit = { kind: "rushing", count: rushed, tip: HABIT_TIPS.rushing, shownToChild: false };
  } else if (timeouts >= TIMEOUTS_MIN) {
    habit = { kind: "timeouts", count: timeouts, tip: HABIT_TIPS.timeouts, shownToChild: false };
  }

  // The child gets two tips at most: the top skill's, then the habit's (or,
  // with no habit, the second skill's).
  const childTips: Tip[] = [];
  if (skillTips[0]) {
    skillTips[0].shownToChild = true;
    childTips.push(skillTips[0].tip);
  }
  if (habit) {
    habit.shownToChild = true;
    childTips.push(habit.tip);
  } else if (skillTips[1]) {
    skillTips[1].shownToChild = true;
    childTips.push(skillTips[1].tip);
  }

  return { ...base, status: childTips.length > 0 ? "tips" : "no_wrong", childTips, skillTips, habit };
}

/** Saves tips for every finished 3-day period this child hasn't got them for
 * yet (skipping periods before the child existed). Safe to call repeatedly
 * and concurrently - called whenever tips are shown, and before anything
 * that would delete the answers they come from. */
export async function ensureSavedTips(childId: string): Promise<void> {
  const child = await queryOne<{ name: string; created_day: string }>(
    `SELECT name, to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS created_day FROM children WHERE id = $1`,
    [childId, TZ]
  );
  if (!child) return;

  const saved = await query<{ start: string; skills: string[] | null }>(
    `SELECT to_char(period_start, 'YYYY-MM-DD') AS start,
            (SELECT array_agg(t->>'skill') FROM jsonb_array_elements(data->'skillTips') t) AS skills
     FROM child_tips WHERE child_id = $1 ORDER BY period_start`,
    [childId]
  );
  const existing = new Set(saved.map((s) => s.start));
  const timesUsed = new Map<string, number>();
  for (const s of saved) for (const skill of s.skills ?? []) timesUsed.set(skill, (timesUsed.get(skill) ?? 0) + 1);

  const currentStart = tipPeriodStartFor(localDateKey());
  let skillNames: Map<string, string> | null = null;
  for (let start = TIP_PERIOD_ANCHOR; start < currentStart; start = addDays(start, TIP_PERIOD_DAYS)) {
    const end = addDays(start, TIP_PERIOD_DAYS - 1);
    if (end < child.created_day || existing.has(start)) continue;
    skillNames ??= new Map((await loadSkills()).map((s) => [s.key, s.name]));
    const tipSet = await buildTipSet(childId, start, timesUsed, skillNames);
    await query(
      `INSERT INTO child_tips (child_id, child_name, period_start, period_end, data) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id, period_start) DO NOTHING`,
      [childId, child.name, start, end, JSON.stringify(tipSet)]
    );
  }
}

/** Every saved tip set for a child, newest first (parents and admin). */
export async function listSavedTips(childId: string): Promise<TipSet[]> {
  await ensureSavedTips(childId);
  const rows = await query<{ data: TipSet }>(
    "SELECT data FROM child_tips WHERE child_id = $1 ORDER BY period_start DESC",
    [childId]
  );
  return rows.map((r) => r.data);
}

/** The tips from the latest finished period - what the child sees now - or
 * null if there is no finished period yet. */
export async function latestTips(childId: string): Promise<TipSet | null> {
  await ensureSavedTips(childId);
  const row = await queryOne<{ data: TipSet }>(
    "SELECT data FROM child_tips WHERE child_id = $1 ORDER BY period_start DESC LIMIT 1",
    [childId]
  );
  return row?.data ?? null;
}
