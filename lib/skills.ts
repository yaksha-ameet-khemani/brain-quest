// The skill map (db/migrations/016_skills.sql). The `skills` table is the one
// list of skills; every bank question points at one of them via
// questions.skill_key, with a skill_step of 1-3 (easier than typical / typical
// / harder than typical for its level). Skills cut across categories - a
// "logic" question about prices is "money" - which is the point: they show
// what a child actually can or can't do, not just which category it was in.
// No database imports here - the admin Question Bank page (a client
// component) uses these too; the DB read is lib/loadSkills.ts.

export type SkillArea = "reasoning" | "numbers" | "shapes" | "words";

export const SKILL_AREAS: { key: SkillArea; name: string }[] = [
  { key: "reasoning", name: "Reasoning" },
  { key: "numbers", name: "Numbers" },
  { key: "shapes", name: "Shapes and space" },
  { key: "words", name: "Words and knowledge" },
];

export interface Skill {
  key: string;
  area: SkillArea;
  name: string;
  description: string;
}

// Math questions are generated fresh each time (lib/mathQuestions.ts), so
// they have no questions row to tag - their skill comes from the template
// that produced them (round_questions.template_key). Every template key must
// appear here; a new template needs a line added.
export const MATH_TEMPLATE_SKILL: Record<string, string> = {
  add: "add_subtract",
  subtract: "add_subtract",
  multiply: "multiply_divide",
  share_equally: "multiply_divide",
  geometric_pattern: "patterns",
  arithmetic_pattern: "patterns",
  cost_difference: "money",
  discount: "money",
  rate_time: "rates",
  rate_distance: "rates",
  work_rate: "rates",
  percentage: "fractions_ratios",
  ratio_split: "fractions_ratios",
  linear_equation: "unknowns",
  linear_equation_both_sides: "unknowns",
  age_problem: "unknowns",
  rectangle_area: "measuring",
  rectangle_perimeter: "measuring",
  circle_circumference: "measuring",
  exponent: "number_facts",
  square_root: "number_facts",
  average_missing: "number_facts",
  gcf: "number_facts",
  dice_probability: "counting",
};
