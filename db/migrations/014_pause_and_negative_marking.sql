-- Two additions to the quiz economy, both toggled per-question or
-- family-wide rather than hardcoded:
--
-- 1. A kid can pause the countdown on a question they want extra time to
--    think through. Paused questions never earn points even if answered
--    correctly, and are excluded from streak and perfect-round bonuses -
--    see app/api/round/[roundId]/answer/route.ts.
alter table round_questions add column paused boolean not null default false;

-- 2. An admin-toggleable, family-wide setting: when on, a wrong answer docks
-- the child half the points a correct one would have earned (silently - the
-- kid is never told). Single-row table; the `id` check constraint (always
-- true) guarantees at most one row. No seed insert here on purpose - the row
-- is created lazily on first toggle (see lib/gameSettings.ts), so a missing
-- row just means "off", the same as the column's own default would mean.
create table game_settings (
  id boolean primary key default true check (id),
  negative_marking boolean not null default false
);
