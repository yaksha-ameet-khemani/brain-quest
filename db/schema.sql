-- Kids Logic & Reward Quiz - database schema
-- Plain Postgres - works on Neon, or any other Postgres host. Run this once
-- against your database (Neon's SQL Editor, or `psql "$DATABASE_URL" -f
-- db/schema.sql`). See docs/SETUP.md for the full walkthrough.
--
-- Security model: this database has no public entry point at all. There is
-- no anon/public API key, no PostgREST layer, nothing exposed to the
-- browser - the connection string is a server-only secret, held only in
-- Vercel's environment variables, and every game operation goes through our
-- own Next.js API routes. Parents authenticate against the `parents` table
-- (email + hashed password, our own session cookie - see lib/requireParent.ts);
-- kids are rows in `children` with a hashed PIN checked by
-- /api/auth/kid-login, also our own code, not a third-party auth service.
--
-- Roles: `parents.role` is 'admin' or 'parent'. The first account ever
-- created becomes admin automatically (see app/api/auth/parent-signup) and
-- public sign-up closes forever after that - every other parent account is
-- created BY the admin (see app/api/admin/parents). There can only ever be
-- one admin row (enforced below by a partial unique index) and the app
-- refuses to ever delete it. Each child has a real owning parent
-- (`children.parent_id`) - a parent only sees/manages their own children;
-- admin sees and manages everyone's.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Parents (includes the one admin). Exactly one row may have role='admin' -
-- enforced by the partial unique index below, not just app logic.
-- ---------------------------------------------------------------------------
create table parents (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'parent' check (role in ('admin', 'parent')),
  created_at timestamptz not null default now()
);
create unique index parents_single_admin_idx on parents (role) where role = 'admin';

-- ---------------------------------------------------------------------------
-- Children (kid profiles). `parent_id` is real ownership, not just a record
-- of who clicked "add": a parent only ever sees/manages their own children.
-- Admin sees and manages every child regardless of parent_id, and can
-- create a child under any parent (or under their own admin account).
-- No ON DELETE clause on purpose (defaults to RESTRICT) - deleting a parent
-- who still has children is refused rather than silently orphaning or
-- cascading away a child's whole history; see app/api/admin/parents/[id].
-- ---------------------------------------------------------------------------
create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id),
  name text not null,
  avatar text not null default '🙂', -- emoji fallback, shown when photo_data_url is null
  photo_data_url text, -- optional photo, already resized/compressed client-side (see lib/imageResize.ts)
  level smallint not null check (level in (1, 2, 3)), -- 1 = younger, 2 = older, 3 = most advanced - not tied to a school grade number
  pin_hash text not null,
  answer_seconds smallint check (answer_seconds is null or answer_seconds between 10 and 300), -- admin override of seconds-per-question; null = use LEVELS[level].perQuestionSeconds
  explain_seconds smallint check (explain_seconds is null or explain_seconds between 0 and 60), -- admin override of the forced explanation-read countdown; null = use EXPLANATION_MIN_READ_SECONDS, 0 = no forced wait
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One row per successful kid PIN login - powers "last logged in" (public)
-- and full login history (admin/parent).
-- ---------------------------------------------------------------------------
create table child_logins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  logged_in_at timestamptz not null default now()
);
create index child_logins_child_idx on child_logins (child_id, logged_in_at);

-- ---------------------------------------------------------------------------
-- Per-child, per-category relative weight, admin-managed - lets an admin
-- give a child more practice in a weak area (or dial an easy one down)
-- without touching the question bank itself. A category with no row here
-- uses lib/config.ts's DEFAULT_CATEGORY_WEIGHT (equal odds). weight = 0
-- means "never pick this category for this child".
-- ---------------------------------------------------------------------------
create table child_category_weights (
  child_id uuid not null references children (id) on delete cascade,
  category text not null check (category in ('math', 'logic', 'riddle', 'spatial')),
  weight int not null default 1 check (weight >= 0),
  primary key (child_id, category)
);

-- ---------------------------------------------------------------------------
-- Skill map: the one fixed list of skills every bank question is tagged with
-- (questions.skill_key). Skills cut across categories. Math questions map to
-- skills by template_key in lib/skills.ts instead. Rows: db/migrations/016.
-- ---------------------------------------------------------------------------
create table skills (
  key text primary key,
  area text not null check (area in ('reasoning', 'numbers', 'shapes', 'words')),
  name text not null,
  description text not null,
  sort_order smallint not null
);

-- ---------------------------------------------------------------------------
-- Question bank (curated logic / riddle / spatial questions). Math questions
-- are generated on the fly from templates (lib/mathQuestions.ts) instead of
-- stored here, so the bank never "runs out" of math content.
-- correct_option_index is NEVER exposed through anything the browser can
-- query directly - only read server-side when building a round, or by an
-- authenticated admin/parent reviewing a child's answer log after the fact.
-- ---------------------------------------------------------------------------
create table questions (
  id uuid primary key default gen_random_uuid(),
  level smallint not null check (level in (1, 2, 3)),
  category text not null check (category in ('logic', 'riddle', 'spatial')),
  question_text text not null,
  options jsonb not null, -- array of 4 strings, canonical storage order
  correct_option_index smallint not null check (correct_option_index between 0 and 3),
  explanation text not null,
  concept text, -- optional admin-set tag grouping questions that test the same
                 -- underlying skill (e.g. 'odd-one-out'), so a checkup round
                 -- (see rounds.kind) can serve a genuinely different question
                 -- on that same skill instead of a same-category guess
  skill_key text references skills (key), -- the one skill it mainly tests; see lib/skills.ts
  skill_step smallint check (skill_step between 1 and 3), -- 1 easier / 2 typical / 3 harder than typical for its level
  is_active boolean not null default true,
  in_rotation boolean not null default true, -- false = only served through a practice set, never in normal rounds
  pen_paper boolean not null default false, -- multi-step: gets game_settings.pen_paper_seconds and a ✏️ label (lib/questionTiming.ts)
  created_at timestamptz not null default now()
);
create index questions_skill_key_idx on questions (skill_key);

-- ---------------------------------------------------------------------------
-- Practice sets (lib/practice.ts): named groups of bank questions an admin
-- assigns to a child as extra, unscored practice, split into fixed rounds so
-- a kid sees "round 3 of 6". Practice rounds (rounds.kind = 'practice') are
-- kept out of every report, the skill map, streaks, checkup and review.
-- ---------------------------------------------------------------------------
create table practice_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table practice_set_questions (
  set_id uuid not null references practice_sets (id) on delete cascade,
  question_id uuid not null references questions (id),
  round_no smallint not null check (round_no >= 1),
  position smallint not null check (position >= 0),
  primary key (set_id, question_id),
  unique (set_id, round_no, position)
);

create table practice_assignments (
  set_id uuid not null references practice_sets (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (set_id, child_id)
);

-- ---------------------------------------------------------------------------
-- Rounds: one quiz attempt of QUESTIONS_PER_ROUND questions.
-- ---------------------------------------------------------------------------
create table rounds (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  level smallint not null check (level in (1, 2, 3)),
  kind text not null default 'standard' check (kind in ('standard', 'review', 'checkup', 'practice')), -- 'review' = replaying past wrong answers for practice, never for points; 'checkup' = a mandatory pre-round recheck using DIFFERENT questions on the same skill, scored normally; 'practice' = one round of an assigned practice set, never scored
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  correct_count smallint not null default 0,
  points_awarded int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  practice_set_id uuid references practice_sets (id) on delete set null, -- kind = 'practice' only
  practice_round_no smallint -- kind = 'practice' only
);
create index rounds_child_started_idx on rounds (child_id, started_at);

-- ---------------------------------------------------------------------------
-- Round questions: a frozen snapshot of each question actually served in a
-- round, WITH OPTIONS ALREADY SHUFFLED for that serving, so the stored
-- option order in `questions` never leaks a pattern to a repeat player.
-- Generated (math) questions are snapshotted here in full, since they don't
-- exist anywhere else. This table doubles as the full answer log an
-- admin/parent can review per child: question_text/options/correct_index/
-- selected_index/is_correct/shown_at/answered_at is everything needed to
-- show "what they were asked, what they picked, was it right, how long did
-- it take".
-- ---------------------------------------------------------------------------
create table round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  position smallint not null,
  source text not null check (source in ('bank', 'generated')),
  question_id uuid references questions (id), -- null for generated math questions
  template_key text, -- which math generator template produced this (source = 'generated' only) -
                      -- lets a checkup round regenerate a fresh question from the SAME template
                      -- (same skill, new numbers) instead of literally repeating it
  category text not null,
  question_text text not null,
  options jsonb not null, -- shuffled order as shown to the kid
  correct_index smallint not null, -- index into the shuffled `options`
  explanation text not null,
  shown_at timestamptz,
  answered_at timestamptz,
  selected_index smallint,
  is_correct boolean,
  points_awarded int not null default 0,
  paused boolean not null default false, -- kid used the "pause timer" button on this one; see app/api/round/[roundId]/answer/route.ts
  pen_paper boolean not null default false, -- snapshot of the question's (or math template's) pen & paper flag when served
  unique (round_id, position)
);

-- ---------------------------------------------------------------------------
-- Points ledger. A child's balance is SUM(amount), never a mutable column -
-- see docs/blueprint.md point 2 for why.
-- ---------------------------------------------------------------------------
create table point_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  type text not null check (type in ('earn', 'redeem', 'refund', 'adjustment')),
  amount int not null, -- signed: earn/refund positive, redeem negative, adjustment either
  reason text,
  round_id uuid references rounds (id),
  redemption_id uuid,
  created_at timestamptz not null default now()
);
create index point_transactions_child_idx on point_transactions (child_id, created_at);

-- ---------------------------------------------------------------------------
-- Family-wide, admin-toggleable game settings - currently just whether a
-- wrong answer docks a child half the points a correct one would have
-- earned (silently - see lib/gameSettings.ts). Single-row table; the `id`
-- check constraint (always true) guarantees at most one row ever exists.
-- ---------------------------------------------------------------------------
create table game_settings (
  id boolean primary key default true check (id),
  negative_marking boolean not null default false,
  pen_paper_seconds smallint not null default 180 check (pen_paper_seconds between 30 and 600) -- timer for pen & paper questions
);

-- ---------------------------------------------------------------------------
-- Reward catalog - editable by parents via the parent dashboard, not hardcoded.
-- ---------------------------------------------------------------------------
create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cost int not null check (cost > 0),
  emoji text not null default '🎁',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Redemption requests. Points are debited (as a 'redeem' transaction) the
-- moment a kid requests a reward, and refunded if a parent denies it - so a
-- balance can never be spent twice while a request is pending.
-- ---------------------------------------------------------------------------
create table redemptions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  reward_id uuid references rewards (id),
  reward_name text not null, -- snapshot, in case the catalog entry changes later
  cost int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'fulfilled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references parents (id),
  note text
);
create index redemptions_child_idx on redemptions (child_id, requested_at);

-- ---------------------------------------------------------------------------
-- Saved 10-day reports, admin-only (see lib/periodReport.ts). One row per
-- child per finished 10-day period, written once and never changed: a frozen
-- record of how that child did then, so it still reads the same later even if
-- the question bank or the child's level changes afterwards. `data` is the
-- whole report as JSON (totals, categories, math skills, day-by-day, missed
-- question samples, points, plain-English insights).
--
-- PERMANENT BY DESIGN - the user's explicit requirement is that no report is
-- ever deleted:
-- * deleting a child does NOT delete their reports - `child_id` is set to
--   null instead, and `child_name` keeps a copy of who the report was about;
-- * the trigger below rejects every DELETE and TRUNCATE, and every UPDATE
--   except that one automatic child_id -> null when a child is deleted.
-- Admin's "reset activity" button deliberately leaves reports alone too.
create table child_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children (id) on delete set null,
  child_name text not null,
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (child_id, period_start)
);

create function child_reports_are_permanent() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.child_id is not null and new.child_id is null
     and new.id = old.id and new.child_name = old.child_name
     and new.period_start = old.period_start and new.period_end = old.period_end
     and new.data = old.data and new.created_at = old.created_at then
    return new; -- the child was deleted; keep the report, just unlink it
  end if;
  raise exception 'child_reports are permanent: % is not allowed', tg_op;
end;
$$;

create trigger child_reports_no_change
  before update or delete on child_reports
  for each row execute function child_reports_are_permanent();

-- TRUNCATE fires per statement (no row to inspect), so it gets its own
-- always-refuse function.
create function child_reports_no_truncate() returns trigger
language plpgsql as $$
begin
  raise exception 'child_reports are permanent: TRUNCATE is not allowed';
end;
$$;

create trigger child_reports_no_truncate
  before truncate on child_reports
  for each statement execute function child_reports_no_truncate();

-- ---------------------------------------------------------------------------
-- Saved tips (lib/tips.ts): one row per child per finished 3-day period,
-- built from that period's wrong answers (practice included) - the child's
-- encouraging tips plus, for parents/admin, the reasons and mistakes.
-- PERMANENT BY DESIGN, exactly like child_reports above: deleting a child only
-- nulls child_id, and the triggers refuse every other UPDATE, DELETE and
-- TRUNCATE. Kept separate from the reports.
-- ---------------------------------------------------------------------------
create table child_tips (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children (id) on delete set null,
  child_name text not null,
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (child_id, period_start)
);

create function child_tips_are_permanent() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.child_id is not null and new.child_id is null
     and new.id = old.id and new.child_name = old.child_name
     and new.period_start = old.period_start and new.period_end = old.period_end
     and new.data = old.data and new.created_at = old.created_at then
    return new; -- the child was deleted; keep the tips, just unlink them
  end if;
  raise exception 'child_tips are permanent: % is not allowed', tg_op;
end;
$$;

create trigger child_tips_no_change
  before update or delete on child_tips
  for each row execute function child_tips_are_permanent();

-- TRUNCATE fires per statement (no row to inspect), so it gets its own
-- always-refuse function.
create function child_tips_no_truncate() returns trigger
language plpgsql as $$
begin
  raise exception 'child_tips are permanent: TRUNCATE is not allowed';
end;
$$;

create trigger child_tips_no_truncate
  before truncate on child_tips
  for each statement execute function child_tips_no_truncate();
