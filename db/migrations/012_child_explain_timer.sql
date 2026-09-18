-- Lets an admin override the forced "read the explanation before continuing"
-- countdown per child too, same idea as migration 011's answer_seconds but
-- for the explanation screen instead of the question screen. Null (the
-- default for every existing child) means "use lib/config.ts's
-- EXPLANATION_MIN_READ_SECONDS default". 0 is allowed on purpose - it lets
-- an admin turn the forced wait off entirely for a specific kid.
alter table children add column explain_seconds smallint
  check (explain_seconds is null or explain_seconds between 0 and 60);
