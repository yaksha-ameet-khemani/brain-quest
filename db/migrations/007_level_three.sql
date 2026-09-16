-- Allows level 3 wherever level 1/2 was the only option: children,
-- questions, and rounds. lib/config.ts's Level/MAX_LEVEL/nextLevel() were
-- deliberately written to generalize to a new top level without further
-- code changes - this migration plus the level 3 question bank (migration
-- 008) is what makes that actually true. See docs/blueprint.md.
alter table children drop constraint children_level_check;
alter table children add constraint children_level_check check (level in (1, 2, 3));

alter table questions drop constraint questions_level_check;
alter table questions add constraint questions_level_check check (level in (1, 2, 3));

alter table rounds drop constraint rounds_level_check;
alter table rounds add constraint rounds_level_check check (level in (1, 2, 3));
