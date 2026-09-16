-- Adds an optional photo per child, stored as a data: URL (already resized
-- and compressed client-side to a small thumbnail before upload - see
-- lib/imageResize.ts - so this stays lightweight in the database). NULL
-- means "no photo yet", in which case the emoji avatar is shown instead.
-- Purely additive - safe to run against a live database with existing data.
alter table children add column photo_data_url text;
