-- Saved tips (docs/blueprint.md v39, lib/tips.ts). Every fixed 3-day period
-- (16-18 Sep, 19-21 Sep, ...), each child's wrong answers from that period -
-- every round kind, practice included - are turned into tips: an
-- encouraging version for the child (no scores, no "weak"), and for their
-- parent and the admin the same tips with the reason and the actual
-- mistakes. One row per child per finished period, written once and never
-- changed, so a later month-end analysis can read exactly what was shown.
-- Kept apart from reports: nothing in the reports reads or shows tips.
--
-- PERMANENT BY DESIGN - the user's explicit requirement is that tips are
-- stored for all time and never deleted. Same protection as child_reports
-- (db/migrations/015_child_reports.sql):
-- * deleting a child does NOT delete their tips - `child_id` is set to null
--   and `child_name` keeps a copy of who they were for;
-- * the trigger below rejects every DELETE and TRUNCATE, and every UPDATE
--   except that one automatic child_id -> null when a child is deleted.
-- Admin's "reset activity" saves any tips not yet saved, then leaves them.
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
