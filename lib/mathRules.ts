import "server-only";
import { query, withTransaction } from "@/lib/db";
import { templateKeysFor } from "@/lib/mathQuestions";
import type { Level } from "@/lib/config";

// Per-child rules for generated math question types (child_math_rules,
// db/migrations/023). A parent may not have taught a topic yet (percentages,
// age puzzles) or may want one to come up rarely - so admin can mark each
// math template, per child, as:
// * "never"  - not served to this child at all;
// * "weekly" - served at most once in any rolling 7 days;
// * "every_2_days" - served at most once in any rolling 2 days.
// Anything without a rule is normal. Used by lib/buildRound.ts for standard
// (bonus level included) and checkup rounds.

export type MathRule = "normal" | "every_2_days" | "weekly" | "never";
type StoredRule = Exclude<MathRule, "normal">;

/** How many days a limited template waits after being served. */
export const RULE_GAP_DAYS: Record<"weekly" | "every_2_days", number> = { weekly: 7, every_2_days: 2 };

/** Plain names for the admin Settings card. */
export const MATH_TEMPLATE_LABEL: Record<string, string> = {
  add: "Plain addition (What is 35 + 37?)",
  subtract: "Plain subtraction (What is 75 - 41?)",
  multiply: "Plain multiplication (What is 2 x 10?)",
  share_equally: "Sharing equally (candies among friends)",
  geometric_pattern: "Doubling patterns (2, 4, 8, 16...)",
  arithmetic_pattern: "Counting-on patterns (2, 5, 8, 11...)",
  cost_difference: "Two prices puzzle (cost together / difference)",
  rate_time: "Time per item (minutes to wash plates)",
  fruit_equation: "Fruit equations",
  percentage: "Percentages (25% of 37)",
  linear_equation: "Solve for x (2x + 16 = 20)",
  rectangle_area: "Rectangle area",
  rectangle_perimeter: "Rectangle perimeter",
  rate_distance: "Speed and distance (km/h)",
  ratio_split: "Ratios (split in the ratio 4:3)",
  work_rate: "Work rate (cats catching mice)",
  age_problem: "Age puzzles (mother is 3 times as old...)",
  exponent: "Powers (exponents)",
  square_root: "Square roots",
  linear_equation_both_sides: "Solve for x, x on both sides",
  discount: "Discounts (% off)",
  circle_circumference: "Circle circumference",
  average_missing: "Missing number for an average",
  gcf: "Greatest common factor",
  dice_probability: "Dice probability",
};

/** template key -> rule, for templates that aren't normal. */
export async function getMathRules(childId: string): Promise<Map<string, StoredRule>> {
  const rows = await query<{ template_key: string; rule: StoredRule }>(
    "SELECT template_key, rule FROM child_math_rules WHERE child_id = $1",
    [childId]
  );
  return new Map(rows.map((r) => [r.template_key, r.rule]));
}

/** A predicate saying whether a template may be served to this child right
 * now. A limited template (weekly / every 2 days) is out if a round started
 * within its gap (RULE_GAP_DAYS, rolling, any round kind) served it;
 * `markServed` records one picked while building a round, so the same round
 * can't take a limited one twice. */
export async function mathTemplateGate(
  childId: string
): Promise<{ allowed: (templateKey: string) => boolean; markServed: (templateKey: string) => void }> {
  const rules = await getMathRules(childId);
  const limited = [...rules].filter(([, rule]) => rule !== "never");
  const blocked = new Set<string>();
  if (limited.length > 0) {
    const rows = await query<{ template_key: string; days_ago: string }>(
      `SELECT rq.template_key, EXTRACT(EPOCH FROM now() - MAX(r.started_at)) / 86400 AS days_ago
       FROM round_questions rq JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.template_key = ANY($2::text[])
       GROUP BY rq.template_key`,
      [childId, limited.map(([key]) => key)]
    );
    for (const r of rows) {
      const rule = rules.get(r.template_key) as keyof typeof RULE_GAP_DAYS;
      if (Number(r.days_ago) < RULE_GAP_DAYS[rule]) blocked.add(r.template_key);
    }
  }
  return {
    allowed: (key) => rules.get(key) !== "never" && !blocked.has(key),
    markServed: (key) => {
      if (rules.has(key)) blocked.add(key);
    },
  };
}

/** Every math template a child at `level` can meet (their level, plus one
 * up for bonus rounds), with its label and this child's current rule. */
export async function listMathRules(childId: string, level: Level) {
  const rules = await getMathRules(childId);
  const levels = (level < 3 ? [level, level + 1] : [level]) as Level[];
  const seen = new Set<string>();
  const out: { key: string; label: string; level: Level; rule: MathRule }[] = [];
  for (const lv of levels) {
    for (const key of templateKeysFor(lv)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const rule: MathRule = rules.get(key) ?? "normal";
      out.push({ key, label: MATH_TEMPLATE_LABEL[key] ?? key, level: lv, rule });
    }
  }
  return out;
}

/** Replaces the rules for the given templates ("normal" removes the row). */
export async function setMathRules(childId: string, rules: Record<string, MathRule>): Promise<void> {
  await withTransaction(async (tx) => {
    for (const [key, rule] of Object.entries(rules)) {
      if (rule === "normal") {
        await tx.query("DELETE FROM child_math_rules WHERE child_id = $1 AND template_key = $2", [childId, key]);
      } else {
        await tx.query(
          `INSERT INTO child_math_rules (child_id, template_key, rule) VALUES ($1, $2, $3)
           ON CONFLICT (child_id, template_key) DO UPDATE SET rule = EXCLUDED.rule`,
          [childId, key, rule]
        );
      }
    }
  });
}
