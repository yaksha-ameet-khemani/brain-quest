# Brain Quest - Blueprint (v7)

This revises `Kids Logic & Reward Quiz Web Application Blueprint.docx` (the
original spec) based on a security/gameplay review. The changes are called
out explicitly below so it's clear what moved and why. This file is the
living reference going forward - the .docx is kept for history.

**v3 update:** the backend moved from Supabase to Neon (plain Postgres),
because Supabase's free tier caps an account at 2 projects and this user
already had two. Since Supabase Auth went away with it, the parent account
is now our own email+password table with a signed session cookie (mirroring
the kid-PIN pattern below) instead of a hosted auth service - see "Real auth
for the parent" below. Everything else - the schema, the economy, the
security model of "nothing but our server ever touches the database" - is
unchanged; Postgres is Postgres either way.

**v4 update - roles and activity tracking:**
- `parents.role` is `'admin'` or `'parent'`. The first account ever created
  becomes admin automatically (a partial unique index on `parents` makes a
  second admin impossible at the database level, not just in app code) and
  can never be deleted. Every other parent account is created by the admin
  from the dashboard - public sign-up stays closed forever once the admin
  exists.
- ~~All parents (admin included) share one pool of children~~ - **superseded,
  see v5 below**: children went back to real per-parent ownership almost
  immediately after this shipped.
- `child_logins` records every successful kid PIN login, powering "last
  logged in" on both the public summary and the admin/parent detail view.
- Two tiers of visibility, by deliberate design:
  - **Public, no login at all** (`/` homepage, `/api/public/activity`):
    aggregate-only per child - last login, total questions attempted,
    correct, wrong, total time spent. No question content, no answers.
  - **Parent/admin, logged in** (`/parent/children/[id]`,
    `/api/parent/children/[id]/log`): the full per-question log - exact
    question text, what the kid picked, the correct answer, right/wrong,
    and time spent on that specific question. `round_questions` already
    stored everything needed for this (it's the same frozen per-serving
    snapshot used for grading); this just exposes it to an authenticated
    parent/admin instead of only ever being read server-side during
    grading.
- The public tier is a deliberate exception to this app's usual "nothing is
  exposed without a session" rule, made explicitly at the user's request and
  with the same reasoning applied earlier to making the GitHub repo public:
  low-traffic private deployment, URL not shared beyond the family, and the
  public tier is aggregate-only (no question content, no individual answers)
  - the sensitive detail stays behind the parent/admin login.

**v5 update - real child ownership:** the "shared pool" from v4 lasted about
one round-trip of user feedback. `children.parent_id` (renamed from
`created_by`) is now `NOT NULL` with a real foreign key and no `ON DELETE`
cascade (defaults to `RESTRICT`) - a parent only ever sees/manages their own
children; admin sees/manages everyone's. Creating a child now requires
knowing who it belongs to: a parent's own children are auto-owned by them,
while admin must pick (or first create) the owning parent - there's no way
to create an "orphaned" child. A parent who still has children can't be
deleted (checked in-app with a clear message, and backed by the database
itself as a second line of defense) - admin can reassign a child to a
different parent first if they actually want to remove someone.

**v6 update - question bank management + per-child category priority:**
- Admin gets a **Question Bank** page (`/parent/questions`,
  `/api/admin/questions`) to add, edit, and archive curated logic/riddle/
  spatial questions (math stays generated, so it isn't managed here), and to
  see each question's "proficiency" - attempts/correct/success-rate,
  computed from `round_questions` history rather than stored redundantly.
  There's no hard delete: a question that's ever been served is referenced
  by a child's permanent answer history, so "archive" (`is_active = false`)
  is what removing one from rotation means.
- New `child_category_weights` table: a per-child, per-category relative
  weight (default equal across all four categories) that an admin can tune
  from that child's log page - e.g. weight logic higher for a child who's
  weak there, per the category breakdown that's already on the dashboard.
  Weight 0 means "never this category for this child"; if every category
  somehow ends up weight 0, round-building falls back to equal odds instead
  of erroring.
- `lib/buildRound.ts` was reworked around this: each of the
  `QUESTIONS_PER_ROUND` slots in a round independently draws a category via
  weighted random choice, then pulls a question for that category (bank
  lookup, or a freshly generated one for math) - replacing the old fixed
  "3 bank + 2 generated" split. If a chosen category's bank pool is empty at
  that child's level (nothing seeded, or everything archived), it falls
  back to another category with something available, and ultimately to
  generated math, which is never empty - a round can never fail to build.

## Goal

A home web app for the family's kids: logic/math/riddle quizzes, earn points
for correct answers, redeem points for real rewards. Zero ongoing cost.

## What changed from the original doc, and why

1. **Answers never reach the browser.** The original stored
   `correct_option_index` in a table the client would read directly, and
   shipped a "local fallback JSON" of every question+answer to the browser.
   Any kid who opens DevTools finds the answer key in minutes. Now: the
   browser only ever talks to our own Next.js API routes, which hold the
   only database credential that exists (server-only, never sent to the
   client) to grade answers and never include `correct_index`/`explanation`
   in a response until *after* that question is answered.

2. **Points are a ledger, not a mutable column.** `point_transactions` is
   append-only; a balance is `SUM(amount)`. This makes the balance
   tamper-resistant (nothing writes it directly) and gives a full audit
   trail ("where did my points come from?").

3. **Real auth for the parent, PIN for kids.** The parent has an email+password
   account (`parents` table, scrypt-hashed password, our own signed session
   cookie - see `lib/requireParent.ts`). Sign-up is capped at one account by
   the app itself: the moment that first account exists, further sign-ups
   are rejected, no dashboard toggle to remember. Kids pick their profile and
   type a short PIN (same scrypt hashing, rate-limited 5 tries/minute) -
   enough friction for a family app without needing an email account per
   9-year-old.

4. **Schema fixes:**
   - Parents are no longer rows in the same table as kids (that made the old
     schema's `grade_level NOT NULL` constraint impossible to satisfy for a
     parent row). Parents are their own `parents` table; kids are a separate
     `children` table referencing it.
   - `level` (1/2) replaces `grade_level` (4/8) so the app doesn't need a
     migration every September.
   - `redemptions.status` now has a real lifecycle: `pending → approved/denied
     → fulfilled`, and denying refunds the points automatically.
   - There is no public entry point to the database at all - no anon/public
     API key, no PostgREST layer. The connection string is a server-only
     secret; every game operation goes through our own Next.js API routes.
     That's simpler than writing RLS policies: there's nothing else that can
     legitimately reach the tables to lock down.

5. **Content never runs out.** The original 20-question bank would be
   exhausted in a single day of max play. Math questions are now generated
   from templates at request time (`lib/mathQuestions.ts`) - effectively
   infinite variety. Logic/riddle/spatial stay as a curated, hand-verified
   bank (`db/seed.sql`), with recently-served questions avoided when
   there's enough pool left to do so, and options re-shuffled on every
   serving so a fixed storage order never becomes memorizable.

6. **Points rebalanced to be roughly equal across levels.** The original
   numbers let a Level 2 player earn ~50% faster than Level 1 for the same
   effort (harder questions paying more on top of already being harder), and
   let a 500-point toy be earned in under 2 days flat-out. New numbers target
   a 500-point reward taking roughly a week of normal (not maxed-out) play,
   with both levels earning similarly per round. See `lib/config.ts` -
   that file is the single place to retune the economy.

7. **Timer is per-question, not per-round**, and generous rather than
   punishing: 45s (Level 1) / 90s (Level 2) per question, with a small speed
   bonus for answering well inside that window rather than a hard fail for
   being a little slow. Timing is validated server-side against
   `shown_at`, so editing client JS can't extend it.

8. **Round resume.** Closing the browser mid-round no longer loses progress
   or burns a daily attempt - `/api/round/start` resumes an existing
   in-progress round if one exists.

9. **Parent analytics** (`/api/parent/overview`) show per-category accuracy
   per child - the actual point of a parent dashboard (knowing what to help
   with), not just a balance the kid screen already shows.

10. **Free-tier caveat documented, not silently assumed:** free Postgres
    hosts (including Neon) auto-suspend an idle database's compute after a
    short period - invisible in practice (next query just waits a moment to
    wake it), but `.github/workflows/keepalive.yml` (also free) pings the app
    weekly as a hedge against any provider's longer-term inactivity policy.
    See `docs/SETUP.md`.

## Point economy (current numbers, in `lib/config.ts`)

| | Level 1 | Level 2 |
|---|---|---|
| Per-question timer | 45s | 90s |
| Points per correct | 10 | 12 |
| Perfect-round bonus (5/5) | +8 | +10 |
| Streak multiplier (3+ in a row) | 1.5x | 1.5x |
| Speed bonus (answer in <40% of time) | +2 | +2 |
| Max rounds/day | 3 | 3 |

Rough max-effort daily ceiling (5 questions/round, all correct, all fast,
streak active from Q3): **Level 1 ≈ 3 × (5×10×1.5 + 8 + 5×2) ≈ 279**,
**Level 2 ≈ 3 × (5×12×1.5 + 10 + 5×2) ≈ 330** - close enough across levels
that a 4th-grader isn't watching an 8th-grader's balance pull far ahead for
the same daily effort, while still rewarding the harder question set a
little more.

## Reward catalog (starter values, editable from the parent dashboard)

| Points | Reward |
|---|---|
| 50 | Small snack / 30 min screen time |
| 80 | Pick tonight's dinner |
| 150 | Park outing / movie night pick |
| 500 | A toy, or a special day outing |

At the ceiling above, 500 points takes roughly 1.5-2 days of *maxed-out*
play, or closer to a week of normal (not-every-round-perfect) play - tune
`DEFAULT_REWARDS` / `POINTS_PER_CORRECT` in `lib/config.ts` if that doesn't
match how fast you want rewards to arrive.

## Data model

See `db/schema.sql` for the authoritative version, with comments. Summary:
`parents`, `children`, `questions` (curated bank), `rounds` +
`round_questions` (frozen per-serving snapshot, including shuffled option
order and the answer - readable only server-side), `point_transactions`
(the ledger), `rewards`, `redemptions`.

## Stack

Next.js 14+ (App Router) + TypeScript + Tailwind, hosted on Vercel's free
tier (`*.vercel.app`, no domain purchase needed). Neon free tier (plain
Postgres, accessed via `pg` - see `lib/db.ts`). GitHub free private repo. No
paid API, SMS, or email service anywhere in the stack - see `docs/SETUP.md`
for the full free-tier walkthrough and its one caveat (the idle-suspend
behavior above). The database layer isn't Neon-specific - any Postgres host
that gives you a connection string works, so this isn't locked to one
provider either.

## Deliberately out of scope for v1

- Multi-family/multi-tenant support (this is a single-household app - every
  child in the table shows on the picker screen, by design).
- A parent UI for editing/deactivating individual bank questions (they can be
  added via `db/seed.sql` or a direct SQL insert for now; `POST
  /api/rewards` exists for the reward catalog, an equivalent for questions is
  a reasonable next step if the seeded bank needs expanding).
- Spaced-repetition review of missed questions (flagged as a good addition
  later - the biggest single learning lever, deliberately deferred to keep
  v1 shippable).

**v7 update - daily bonus-level unlock:** per user request, a child isn't
capped at their assigned level forever. `children.level` still means their
base level (unchanged), but each day, finishing all of that day's
`MAX_ROUNDS_PER_DAY` rounds with better than `LEVEL_UNLOCK_ACCURACY_THRESHOLD`
(75%) unlocks `BONUS_ROUNDS_PER_DAY` (3) extra rounds at the next level up,
for that day only - it resets with the daily round count, the same way the
base rounds do. Deliberately not a permanent promotion: a strong day earns a
stretch challenge, it doesn't silently change what a parent set as the
child's level. Reuses the existing Level 2 content as-is (no new question
bank needed) - `lib/config.ts`'s `nextLevel()` and `MAX_LEVEL` are what make
this generalize to a Level 3+ later without changing this logic, once that
content exists.

- `lib/levelProgress.ts` computes this from data that already exists -
  `rounds.level` distinguishes a base-level round from a bonus-level one
  without any new column, so "how many bonus rounds used today" is just
  "how many rounds at level = next(baseLevel) started today," same query
  shape as the base daily-limit check.
- `POST /api/round/start` accepts an optional `{ level }` - defaults to the
  child's base level; requesting the bonus level is validated server-side
  against today's unlock state and remaining bonus-round quota regardless of
  what the client shows, the same defense-in-depth as everywhere else a kid-
  facing choice gets re-checked server-side.
- The kid dashboard shows live progress toward the unlock ("2/3 rounds,
  82% correct so far") before it's earned, and a distinct bonus-round button
  once it is - transparency was the point, not a surprise unlock.
- Verified end-to-end against the real database with two throwaway
  children: one that played 3/3 rounds at 100% correctly unlocked exactly 3
  bonus Level 2 rounds (with a 4th correctly refused once used up); one that
  played 3/3 rounds at 0% correctly stayed locked, with the dashboard
  showing accurate progress numbers and a direct bonus-round request
  correctly refused. A Level 2 base child (already at `MAX_LEVEL`) correctly
  shows no bonus UI at all.

**v8 update - the homepage activity summary is now admin-only:** v6 added a
public, no-login "Family Activity" summary (last login, questions
attempted/correct/wrong, time spent) to the homepage at the family's own
request. Once real data was in it, the same user asked to hide it - with
several kids' numbers sitting side by side under each other's names on the
first screen anyone sees, it read as a sibling leaderboard rather than a
private parent-facing stat. Reversing an earlier explicit decision like this
isn't a bug fix, it's the user changing their mind once they saw the real
thing in practice - noted here for the record, not relitigated.

- `app/api/public/activity` (no-auth) is deleted outright; there is no
  unauthenticated way to reach this data anymore.
- `lib/publicActivity.ts` renamed to `lib/childActivitySummary.ts`
  (`getPublicActivity()` → `getChildActivitySummary()`) to stop the name
  itself implying "safe to expose without auth."
- The same aggregate data now lives behind a new `GET /api/admin/activity`,
  gated by `requireAdmin()` - the same guard already used for
  `/api/admin/parents` - and rendered in a new "🛡️ Family activity (admin
  only)" section on `ParentDashboard.tsx`, visible only when `role ===
  "admin"`. A non-admin parent still gets their own per-child detail via the
  existing `/api/parent/overview` and `/parent/children/[childId]` (that was
  never part of what got hidden - only the *cross-child, all-kids-at-once*
  view moved behind admin).
- `app/page.tsx` (the homepage) no longer queries or renders any activity
  data at all - it's back to just the child picker + Parent Mode link.
- Verified against the real database: a throwaway non-admin parent account
  gets 401 from `/api/admin/activity` (confirmed live, via a real login and
  session cookie) while still getting 200 from `/api/parent/overview`; the
  homepage HTML contains no activity/stat text; the old public route 404s;
  and the underlying aggregate query itself was independently re-run
  against production and confirmed to return the correct, current numbers
  for all four real child profiles.

**v9 update - wrong-answer review rounds:** per user request, a child can
now replay questions they most recently got wrong, purely for practice -
never for points, never counted against the daily round limit. This is the
single biggest learning lever that v1 deliberately deferred (see the very
first entry in this file's "possible additions" list); it reuses the
existing round/round_questions machinery almost entirely rather than
building a parallel system.

- `rounds.kind` (migration `006_review_rounds.sql`) is `'standard'` or
  `'review'` - the only new column needed. Everything else (round_questions,
  answer grading, resume-in-progress logic) is the same table shape as
  before.
- "Wrong" means: this bank question's *most recent* attempt by this child
  (standard or review, doesn't matter) came back incorrect -
  `lib/buildRound.ts`'s `buildReviewQuestions()` and the count-only
  `lib/reviewProgress.ts`'s `getReviewProgress()` share this definition via
  the same `DISTINCT ON (question_id) ... ORDER BY answered_at DESC` query
  shape. Only bank questions (logic/riddle/spatial) qualify, not generated
  math - a fresh math problem next time has different numbers, so there's
  no fixed question to "get right this time." A side effect worth calling
  out because it wasn't deliberately engineered: since this always looks at
  the *latest* attempt, getting a review question right makes it stop
  showing up next time and getting it wrong again keeps it in rotation -
  free spaced repetition, for no extra bookkeeping.
- A review round's length is however many wrong questions exist, capped at
  `MAX_REVIEW_QUESTIONS` (5) - not the fixed `QUESTIONS_PER_ROUND` a
  standard round always has. This forced a real fix, not just new code: the
  answer route previously decided "is this the last question" via
  `position === QUESTIONS_PER_ROUND - 1`, a hardcoded assumption that would
  have been silently wrong for any round shorter than 5. It now counts the
  round's actual `round_questions` rows instead - correct for both standard
  and review rounds, and no longer coupled to a global constant that
  happened to match by coincidence before.
- Capped at `REVIEW_ROUNDS_PER_DAY` (1) so it stays a focused top-up, not a
  way to grind past the daily round limit; `POST /api/round/start` takes
  `{ mode: "review" }` instead of `{ level }`, and refuses with a clear
  reason (nothing to review vs. today's review already used) if it can't
  build one.
- No points, ever, for a review round - `points_awarded`, streak bonus,
  speed bonus, and perfect-round bonus are all skipped server-side when
  `round.kind === 'review'`, regardless of what the client sends. The kid
  dashboard's new "🔁 Review N tricky questions (no points, just practice)"
  card and the quiz page's review banner set that expectation up front so
  it's never a surprise mid-round.
- Verified end-to-end against the real database with a throwaway child:
  played a standard round answering everything wrong, confirmed a review
  round surfaced exactly the one bank (non-math) question missed with a
  dynamic `totalQuestions: 1`; answered it correctly and confirmed
  `pointsAwarded: 0` and an unchanged balance; confirmed a second review
  attempt the same day is refused, with the error message correctly
  distinguishing "nothing left to review" from "today's review already
  used" depending on whether wrong questions still exist; confirmed the
  dashboard card reflects the exhausted state accurately. Cleaned up
  afterward.

**v10 update - daily/weekly streak recognition:** per user request, a kid
now sees a "🔥 N day streak" / "🗓️ N week streak" badge on their dashboard
when they've been playing consistently - pure recognition, no new points or
mechanics attached to it.

- `lib/streak.ts`'s `getStreaks()` computes both from the same source
  everything else in the app already uses for "did they play" -
  `rounds.status = 'completed'`, any `kind` (standard, bonus-level, or
  review all count; the point is showing up, not which mode). Day
  boundaries use the existing `lib/timezone.ts` `localDateKey()` helper, so
  a streak lines up with the family's actual day rather than raw UTC.
- A streak is "still alive" through today AND through a single skipped day
  before it breaks - playing yesterday but not yet today doesn't zero out
  the count, since today isn't over. The same logic applies one level up
  for weekly (Sunday-start week buckets): played last week but not yet this
  week still counts as an alive weekly streak, since this week isn't over
  either. This was deliberately verified with a throwaway account (see
  below), not just written and assumed correct, since it's an easy place to
  off-by-one.
- Also surfaced to admin: `getChildActivitySummary()` now includes each
  child's current daily/weekly streak alongside the existing
  attempted/correct/time stats, shown as `🔥 Nd` / `🗓️ Nw` in the "Family
  activity" admin section - a natural fit since that's already the
  per-child-at-a-glance view.
- Verified against the real database with a throwaway child: four
  backdated completed rounds on four consecutive days correctly showed
  "🔥 4 day streak · 🗓️ 1 week streak" on the dashboard; replacing that
  history with a single round from 5 days ago correctly dropped the daily
  streak to 0 (no badge) while the weekly streak stayed at 1 - the last
  week actually played is still within the "one skipped week is still
  alive" window, not yet broken. Cleaned up afterward.

**v11 update - automated backups:** per user request, `.github/workflows/
backup.yml` dumps every table to JSON daily via `scripts/backup.mjs`. The
one real design decision here: the destination can't be this repo, since
it's public and a full table dump necessarily contains family PII (names,
emails, hashed passwords/PINs, kid photos) - so it pushes into a second,
**separate, private** GitHub repo instead (private repos are free, same as
everything else in this stack). That repo and the fine-grained PAT to push
to it are things only the account owner can create (the same reasoning as
avoiding a Vercel↔GitHub account link earlier in this doc) - not something
done from inside this session. The workflow is written to no-op safely
(a skipped run with a warning, not a failure) until `docs/SETUP.md`'s new
"Automated backups" section's one-time setup is done.

- `scripts/backup.mjs` is a plain script using the same `pg` dependency the
  app already has - no new dependency - and dumps every table in
  `db/schema.sql` verbatim (hashes included; the destination repo is
  private and trusted at the same level as the production database itself,
  and a backup missing the fields needed to actually restore isn't much of
  a backup) to one JSON file per table plus a `_manifest.json` with row
  counts and a timestamp.
- Verified by actually running it against the real production database
  (read-only - `SELECT * FROM <table>`, nothing written): row counts came
  back sane and matching known state (120 questions, 3 parents, 4
  children, etc.), confirming the query and JSON output work end-to-end,
  not just that the code compiles.
- Restore is deliberately not built yet - there's no working restore
  script, since there's never been a need for one. Noted here rather than
  silently left out, per the user's own request to flag what's deferred and
  why.
