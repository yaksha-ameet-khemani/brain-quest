-- Pen & paper questions (docs/blueprint.md v38): multi-step questions that
-- are worth working out on paper get a longer, admin-set timer and a ✏️ label.
--
-- * game_settings.pen_paper_seconds: the timer for those questions (default
--   3 minutes). A child's own answer timer still wins if it is longer.
-- * questions.pen_paper: set here for bank questions at Level 2-3 on the
--   multi-step skills (find the unknown, speed and rates, fractions and
--   ratios, money, counting cleverly) that actually have numbers to work
--   with - this leaves out the family-relation puzzles tagged "unknowns",
--   and Level 1, whose questions on those skills are all one step. Admin can
--   switch it per question on the Question Bank page. Generated math sets it
--   per template (lib/mathQuestions.ts).
-- * round_questions.pen_paper: snapshot of the flag for each served
--   question, so its timer can't change mid-round.

alter table game_settings add column pen_paper_seconds smallint not null default 180
  check (pen_paper_seconds between 30 and 600);
alter table questions add column pen_paper boolean not null default false;
alter table round_questions add column pen_paper boolean not null default false;

update questions set pen_paper = true
where level >= 2
  and skill_key in ('unknowns', 'rates', 'fractions_ratios', 'money', 'counting')
  and question_text ~ '[0-9]';
