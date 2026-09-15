-- Kids Logic & Reward Quiz - database schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push`) on a
-- fresh project. See docs/SETUP.md for the full walkthrough.
--
-- Security model: every table has Row Level Security enabled with NO
-- policies defined. That means the anon/authenticated roles (what the
-- browser can ever use) can read or write NOTHING directly - every game
-- operation goes through our Next.js route handlers using the service role
-- key, which bypasses RLS entirely and lives only in server environment
-- variables. Parents authenticate as real Supabase Auth users
-- (auth.users); kids are rows in `children` with a hashed PIN checked by
-- our own /api/auth/kid-login route, not Supabase Auth.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Children (kid profiles). One row per kid, owned by the parent who created it.
-- ---------------------------------------------------------------------------
create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  avatar text not null default '🙂',
  level smallint not null check (level in (1, 2)), -- 1 = younger / 2 = older group, not tied to a school grade number
  pin_hash text not null,
  created_at timestamptz not null default now()
);
alter table children enable row level security;

-- ---------------------------------------------------------------------------
-- Question bank (curated logic / riddle / spatial questions). Math questions
-- are generated on the fly from templates (lib/mathQuestions.ts) instead of
-- stored here, so the bank never "runs out" of math content.
-- correct_option_index is NEVER exposed through anything the browser can
-- query directly - only read server-side when building a round.
-- ---------------------------------------------------------------------------
create table questions (
  id uuid primary key default gen_random_uuid(),
  level smallint not null check (level in (1, 2)),
  category text not null check (category in ('logic', 'riddle', 'spatial')),
  question_text text not null,
  options jsonb not null, -- array of 4 strings, canonical storage order
  correct_option_index smallint not null check (correct_option_index between 0 and 3),
  explanation text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table questions enable row level security;

-- ---------------------------------------------------------------------------
-- Rounds: one quiz attempt of QUESTIONS_PER_ROUND questions.
-- ---------------------------------------------------------------------------
create table rounds (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  level smallint not null check (level in (1, 2)),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  correct_count smallint not null default 0,
  points_awarded int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table rounds enable row level security;
create index rounds_child_started_idx on rounds (child_id, started_at);

-- ---------------------------------------------------------------------------
-- Round questions: a frozen snapshot of each question actually served in a
-- round, WITH OPTIONS ALREADY SHUFFLED for that serving, so the stored
-- option order in `questions` never leaks a pattern to a repeat player.
-- Generated (math) questions are snapshotted here in full, since they don't
-- exist anywhere else.
-- ---------------------------------------------------------------------------
create table round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  position smallint not null,
  source text not null check (source in ('bank', 'generated')),
  question_id uuid references questions (id), -- null for generated math questions
  category text not null,
  question_text text not null,
  options jsonb not null, -- shuffled order as shown to the kid
  correct_index smallint not null, -- index into the shuffled `options`
  explanation text not null,
  shown_at timestamptz not null default now(),
  answered_at timestamptz,
  selected_index smallint,
  is_correct boolean,
  points_awarded int not null default 0,
  unique (round_id, position)
);
alter table round_questions enable row level security;

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
alter table point_transactions enable row level security;
create index point_transactions_child_idx on point_transactions (child_id, created_at);

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
alter table rewards enable row level security;

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
  decided_by uuid references auth.users (id),
  note text
);
alter table redemptions enable row level security;
create index redemptions_child_idx on redemptions (child_id, requested_at);
