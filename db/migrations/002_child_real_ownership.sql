-- Applied directly against the live database on 2026-09-15 (children table
-- was empty at the time, so this was a safe in-place migration - a fresh
-- install just uses the already-updated db/schema.sql instead of this file).
--
-- Turns `children.created_by` (an audit-only note of who clicked "add",
-- with no access-control meaning - every parent could see/manage every
-- child) into `children.parent_id`: real ownership. A parent now only
-- ever sees/manages their own children; admin still sees/manages all of
-- them, and is the only one who can create a child under a different
-- parent (or reassign one afterward).
alter table children rename column created_by to parent_id;
alter table children drop constraint children_created_by_fkey;
alter table children alter column parent_id set not null;
alter table children add constraint children_parent_id_fkey foreign key (parent_id) references parents (id);
