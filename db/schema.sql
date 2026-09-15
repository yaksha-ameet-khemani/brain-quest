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

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Parents. Deliberately capped at one row by application logic (see
-- app/api/auth/parent-signup) - this is a single-household app, not a
-- multi-tenant SaaS, so the first successful sign-up locks the door.
-- ---------------------------------------------------------------------------
create table parents (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Children (kid profiles). One row per kid, owned by the parent who created it.
-- ---------------------------------------------------------------------------
create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id) on delete cascade,
  name text not null,
  avatar text not null default '🙂',
  level smallint not null check (level in (1, 2)), -- 1 = younger / 2 = older group, not tied to a school grade number
  pin_hash text not null,
  created_at timestamptz not null default now()
);

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
  shown_at timestamptz,
  answered_at timestamptz,
  selected_index smallint,
  is_correct boolean,
  points_awarded int not null default 0,
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
