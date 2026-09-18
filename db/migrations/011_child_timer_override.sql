-- Lets an admin override how many seconds a specific child gets per question,
-- instead of everyone at a level sharing lib/config.ts's LEVELS[level]
-- .perQuestionSeconds. Null (the default for every existing child) means
-- "use the level default" - this is purely an override, not a replacement
-- for the level system. See app/api/admin/children/[childId]/timer/route.ts.
alter table children add column answer_seconds smallint
  check (answer_seconds is null or answer_seconds between 10 and 300);
