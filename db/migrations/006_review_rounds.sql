-- Wrong-answer review rounds: a child can replay questions they most
-- recently got wrong, for practice - never for points. `kind` distinguishes
-- this from a normal scored round; everything else (round_questions,
-- answer grading) is reused as-is. See docs/blueprint.md v9 and
-- lib/buildRound.ts's buildReviewQuestions().
alter table rounds add column kind text not null default 'standard' check (kind in ('standard', 'review'));
