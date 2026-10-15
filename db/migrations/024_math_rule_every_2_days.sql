-- Adds a third math-type limit (docs/blueprint.md v48, lib/mathRules.ts):
-- 'every_2_days' = served at most once in any rolling 2 days. The user found
-- once a week too rare for Banku's ratio questions.
alter table child_math_rules drop constraint child_math_rules_rule_check;
alter table child_math_rules add constraint child_math_rules_rule_check
  check (rule in ('never', 'weekly', 'every_2_days'));
