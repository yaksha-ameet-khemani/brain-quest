-- Per-child rules for generated math question types (docs/blueprint.md v47,
-- lib/mathRules.ts). One row per child per math template that is NOT normal:
-- * 'never'  - this child is never served that template (e.g. percentages
--   before a parent has taught them);
-- * 'weekly' - served at most once in any rolling 7 days.
-- No row = normal. Applies to standard (including bonus-level) and checkup
-- rounds. Admin sets these on the child page's Settings tab.
create table child_math_rules (
  child_id uuid not null references children (id) on delete cascade,
  template_key text not null,
  rule text not null check (rule in ('never', 'weekly')),
  primary key (child_id, template_key)
);
