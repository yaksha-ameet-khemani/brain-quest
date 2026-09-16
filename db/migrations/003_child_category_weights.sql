-- Adds the table backing per-child category priority (admin sets how often
-- each category should come up for a given child - see lib/categoryWeights.ts).
-- Purely additive - safe to run against a live database with existing data.
create table child_category_weights (
  child_id uuid not null references children (id) on delete cascade,
  category text not null check (category in ('math', 'logic', 'riddle', 'spatial')),
  weight int not null default 1 check (weight >= 0),
  primary key (child_id, category)
);
