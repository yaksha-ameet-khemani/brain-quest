-- Wipes every table (all parents, children, rounds, points, redemptions -
-- everything) so db/schema.sql can be re-run fresh. Irreversible - only run
-- this when you actually mean to start over.
-- NOTE: child_reports (saved 10-day reports) is deliberately NOT dropped here -
-- those reports are meant to be permanent (see db/migrations/015).
drop table if exists redemptions cascade;
drop table if exists rewards cascade;
drop table if exists game_settings cascade;
drop table if exists point_transactions cascade;
drop table if exists round_questions cascade;
drop table if exists rounds cascade;
drop table if exists child_logins cascade;
drop table if exists children cascade;
drop table if exists questions cascade;
drop table if exists parents cascade;
