-- Daily "checkup": before a child's first standard round each day, if they
-- have recent wrong answers, they must clear a short round of DIFFERENT
-- questions testing the same skill - not exact replays like a review round
-- (kind = 'review') - so getting it right this time is evidence they
-- actually understood it, not that they memorized an answer. Scored
-- normally, same as a standard round. See lib/checkupProgress.ts and
-- lib/buildRound.ts's buildCheckupQuestions().
alter table rounds drop constraint rounds_kind_check;
alter table rounds add constraint rounds_kind_check check (kind in ('standard', 'review', 'checkup'));

-- Optional admin-set tag grouping bank questions that test the same
-- underlying skill (e.g. "odd-one-out", "mirror-image") so a checkup can
-- serve a genuinely different question on that same skill instead of a
-- same-category guess. Untagged questions fall back to same-category.
alter table questions add column concept text;

-- Which generator template produced a generated (math) question, so a
-- checkup can regenerate a fresh question from the SAME template (same
-- skill, new numbers) instead of literally repeating it - math questions
-- have no fixed identity to repeat anyway. Null for bank-sourced rows.
alter table round_questions add column template_key text;
