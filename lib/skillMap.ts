import "server-only";
import { query } from "@/lib/db";
import { TZ } from "@/lib/timezone";
import { median } from "@/lib/format";
import { loadSkills } from "@/lib/loadSkills";
import { templateKeysFor } from "@/lib/mathQuestions";
import { MATH_TEMPLATE_SKILL, type Skill, type SkillArea } from "@/lib/skills";
import {
  RUSHED_ANSWER_SECONDS,
  SKILL_MAP_WINDOW_DAYS,
  SKILL_MASTERED_DISTINCT,
  SKILL_MASTERED_PCT,
  SKILL_MIN_ANSWERS,
  SKILL_RECENT_ANSWERS,
  SKILL_SOLID_PCT,
  SKILL_THIN_BANK,
  type Level,
} from "@/lib/config";

// Admin-only skill map: for one child, how they're doing on every skill in the
// skill list (lib/skills.ts). Bank answers get their skill from the question's
// current skill_key, generated math from MATH_TEMPLATE_SKILL. Used live on the
// child page's Skills tab and frozen into each saved 10-day report
// (lib/periodReport.ts). Nothing here is shown to kids.

export type SkillState = "not_seen" | "too_few" | "guessing" | "learning" | "solid" | "mastered";

/** One answered question, reduced to what the skill map needs. */
export interface SkillAnswer {
  skillKey: string;
  questionKey: string; // same value = same question (bank id, or template + text for math)
  isCorrect: boolean;
  timedOut: boolean;
  paused: boolean;
  seconds: number | null;
  day: string; // YYYY-MM-DD, APP_TIMEZONE
}

export interface SkillRow {
  key: string;
  name: string;
  area: SkillArea;
  state: SkillState;
  answered: number;
  correct: number;
  recentAnswered: number; // last SKILL_RECENT_ANSWERS answers - what the state is read from
  recentCorrect: number;
  wrongPicked: number;
  timedOut: number;
  rushedWrong: number; // wrong picks under RUSHED_ANSWER_SECONDS
  paused: number;
  distinctCorrect: number; // different questions answered right
  medianSeconds: number | null; // paused answers left out - their clock was stopped
  lastAnswered: string | null;
  bankAtLevel: number; // active bank questions with this skill at the child's level
  generated: boolean; // the math generator also makes questions for it at that level
  thin: boolean; // weak for this child AND few questions to practise it with
}

export interface SkillSupply {
  level: number;
  bank: Map<string, number>;
  generated: Set<string>;
}

/** The skill an answered question counts toward, or null (old rows from
 * before template keys were recorded, or an untagged bank question). */
export function skillOf(questionSkill: string | null, templateKey: string | null): string | null {
  if (questionSkill) return questionSkill;
  return templateKey ? (MATH_TEMPLATE_SKILL[templateKey] ?? null) : null;
}

export async function loadSkillSupply(level: number): Promise<SkillSupply> {
  const rows = await query<{ skill_key: string; n: string }>(
    `SELECT skill_key, COUNT(*) AS n FROM questions
     WHERE is_active AND in_rotation AND level = $1 AND skill_key IS NOT NULL GROUP BY 1`,
    [level]
  );
  const templates = [1, 2, 3].includes(level) ? templateKeysFor(level as Level) : [];
  return {
    level,
    bank: new Map(rows.map((r) => [r.skill_key, Number(r.n)])),
    generated: new Set(templates.map((k) => MATH_TEMPLATE_SKILL[k]).filter((k): k is string => !!k)),
  };
}

function pct(correct: number, answered: number): number {
  return answered ? Math.round((100 * correct) / answered) : 0;
}

function stateOf(all: SkillAnswer[], recent: SkillAnswer[], distinctCorrect: number): SkillState {
  if (all.length === 0) return "not_seen";
  if (all.length < SKILL_MIN_ANSWERS) return "too_few";
  const recentPct = pct(recent.filter((a) => a.isCorrect).length, recent.length);
  if (recentPct >= SKILL_MASTERED_PCT && distinctCorrect >= SKILL_MASTERED_DISTINCT) return "mastered";
  if (recentPct >= SKILL_SOLID_PCT) return "solid";
  const wrongPicks = recent.filter((a) => !a.isCorrect && !a.timedOut);
  const rushed = wrongPicks.filter((a) => a.seconds !== null && a.seconds < RUSHED_ANSWER_SECONDS);
  if (rushed.length >= 2 && rushed.length * 2 >= wrongPicks.length) return "guessing";
  return "learning";
}

/** `answers` must be newest first. Returns one row per skill, in skill-list order. */
export function summarizeSkills(answers: SkillAnswer[], skills: Skill[], supply: SkillSupply): SkillRow[] {
  return skills.map((skill) => {
    const all = answers.filter((a) => a.skillKey === skill.key);
    const recent = all.slice(0, SKILL_RECENT_ANSWERS);
    const wrongPicks = all.filter((a) => !a.isCorrect && !a.timedOut);
    const distinctCorrect = new Set(all.filter((a) => a.isCorrect).map((a) => a.questionKey)).size;
    const state = stateOf(all, recent, distinctCorrect);
    const bankAtLevel = supply.bank.get(skill.key) ?? 0;
    const generated = supply.generated.has(skill.key);
    return {
      key: skill.key,
      name: skill.name,
      area: skill.area,
      state,
      answered: all.length,
      correct: all.filter((a) => a.isCorrect).length,
      recentAnswered: recent.length,
      recentCorrect: recent.filter((a) => a.isCorrect).length,
      wrongPicked: wrongPicks.length,
      timedOut: all.filter((a) => a.timedOut).length,
      rushedWrong: wrongPicks.filter((a) => a.seconds !== null && a.seconds < RUSHED_ANSWER_SECONDS).length,
      paused: all.filter((a) => a.paused).length,
      distinctCorrect,
      medianSeconds: median(all.filter((a) => !a.paused && a.seconds !== null).map((a) => a.seconds!)),
      lastAnswered: all[0]?.day ?? null,
      bankAtLevel,
      generated,
      thin: (state === "learning" || state === "guessing") && !generated && bankAtLevel < SKILL_THIN_BANK,
    };
  });
}

/** Plain-English skill findings for a report. */
export function skillInsights(rows: SkillRow[], level: number): string[] {
  const out: string[] = [];
  const recent = (r: SkillRow) => `${r.recentCorrect}/${r.recentAnswered}`;
  const learning = rows.filter((r) => r.state === "learning");
  const guessing = rows.filter((r) => r.state === "guessing");
  const mastered = rows.filter((r) => r.state === "mastered");
  const thin = rows.filter((r) => r.thin);
  if (learning.length) out.push(`Skills to work on: ${learning.map((r) => `${r.name} (${recent(r)} recently)`).join(", ")}.`);
  if (guessing.length) {
    out.push(
      `Likely guessing (wrong and fast): ${guessing
        .map((r) => `${r.name} (${r.rushedWrong} of ${r.wrongPicked} wrong answers under ${RUSHED_ANSWER_SECONDS}s)`)
        .join(", ")}.`
    );
  }
  if (mastered.length) out.push(`Mastered: ${mastered.map((r) => `${r.name} (${recent(r)} recently)`).join(", ")}.`);
  if (thin.length) {
    out.push(
      `Weak and thin in the bank at Level ${level} - worth adding questions: ${thin
        .map((r) => `${r.name} (only ${r.bankAtLevel})`)
        .join(", ")}.`
    );
  }
  return out;
}

/** The live skill map for the child page: answers from the last
 * SKILL_MAP_WINDOW_DAYS days, judged against the child's current level. */
export async function buildSkillMap(childId: string, level: number): Promise<{ level: number; windowDays: number; rows: SkillRow[] }> {
  const [skills, supply, answers] = await Promise.all([
    loadSkills(),
    loadSkillSupply(level),
    loadSkillAnswers(
      `r.child_id = $1 AND rq.answered_at >= now() - make_interval(days => $3)`,
      [childId, TZ, SKILL_MAP_WINDOW_DAYS]
    ),
  ]);
  return { level, windowDays: SKILL_MAP_WINDOW_DAYS, rows: summarizeSkills(answers, skills, supply) };
}

/** Skill rows for one 10-day period (inclusive local dates), judged only on
 * that period's answers - what lib/periodReport.ts freezes into a report. */
export async function buildPeriodSkills(childId: string, periodStart: string, periodEnd: string, level: number): Promise<SkillRow[]> {
  const [skills, supply, answers] = await Promise.all([
    loadSkills(),
    loadSkillSupply(level),
    loadSkillAnswers(
      `r.child_id = $1 AND to_char(rq.answered_at AT TIME ZONE $2, 'YYYY-MM-DD') BETWEEN $3 AND $4`,
      [childId, TZ, periodStart, periodEnd]
    ),
  ]);
  return summarizeSkills(answers, skills, supply);
}

/** Answers matching `where` ($2 must be the timezone), newest first, with a skill. */
async function loadSkillAnswers(where: string, args: unknown[]): Promise<SkillAnswer[]> {
  const rows = await query<{
    day: string;
    skill_key: string | null;
    template_key: string | null;
    question_id: string | null;
    question_text: string;
    is_correct: boolean;
    selected_index: number | null;
    paused: boolean;
    seconds: string | null;
  }>(
    `SELECT to_char(rq.answered_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day, q.skill_key, rq.template_key,
            rq.question_id, rq.question_text, rq.is_correct, rq.selected_index, rq.paused,
            EXTRACT(EPOCH FROM rq.answered_at - rq.shown_at) AS seconds
     FROM round_questions rq JOIN rounds r ON r.id = rq.round_id
     LEFT JOIN questions q ON q.id = rq.question_id
     WHERE rq.answered_at IS NOT NULL AND r.kind <> 'practice' AND ${where}
     ORDER BY rq.answered_at DESC`,
    args
  );
  return rows.flatMap((r) => {
    const skillKey = skillOf(r.skill_key, r.template_key);
    if (!skillKey) return [];
    return [
      {
        skillKey,
        questionKey: r.question_id ?? `${r.template_key}:${r.question_text}`,
        isCorrect: r.is_correct,
        timedOut: !r.is_correct && r.selected_index === -1,
        paused: r.paused,
        seconds: r.seconds === null ? null : Number(r.seconds),
        day: r.day,
      },
    ];
  });
}
