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
