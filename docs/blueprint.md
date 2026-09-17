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

**v12 update - Level 3:** per user request, a real third level now exists -
not a bonus/stretch mode like the v7 mechanic, but a full permanent level a
parent can assign, with its own 60-question curated bank (20 logic/riddle/
spatial each) and its own math template set. `lib/config.ts`'s
`Level`/`MAX_LEVEL`/`nextLevel()` were deliberately written back in v7 to
generalize to exactly this without further logic changes - this update is
the proof: `MAX_LEVEL` moved from 2 to 3, and every level-progression,
bonus-round, and daily-cap code path picked it up with zero changes beyond
the constant itself.

- `db/migrations/007_level_three.sql` widens the `level` check constraint
  on `children`, `questions`, and `rounds` from `(1, 2)` to `(1, 2, 3)`.
  `db/migrations/008_level3_question_bank.sql` adds the 60 questions;
  both are also folded into `db/schema.sql`/`db/seed.sql` for fresh
  installs.
- New `lib/config.ts` values: `LEVELS[3]` (label, a 100s per-question timer
  - a little more than level 2's 90s, since the content is harder to read
  through, not just harder to compute), `POINTS_PER_CORRECT[3]` (14) and
  `PERFECT_ROUND_BONUS[3]` (12), continuing the same "close across levels"
  progression as 1 and 2. Also added `ALL_LEVELS`/`isValidLevel()` and used
  them to replace the hardcoded `level !== 1 && level !== 2` checks
  scattered across the profile and question-bank API routes - the kind of
  repeated literal that's exactly how a level 3 rollout goes wrong by half
  (some endpoint quietly still rejecting it) if each call site is
  hand-edited instead of centralized.
- `lib/mathQuestions.ts` gained 8 new level-3 templates (exponents, square
  roots, two-sided linear equations, percentage discounts, circle
  circumference, averages, GCF, and dice probability) - deliberately
  harder concepts than level 2's percentages/ratios/simple algebra, not
  just bigger numbers on the same concepts.
- The 60 curated questions were authored by hand, then checked
  programmatically against the entire existing 120-question bank for two
  things: exact question-text duplicates, and - the more interesting catch
  - the *same well-known riddle reworded differently* (5 of the first-draft
  riddles turned out to be near-verbatim restatements of riddles already in
  the bank, e.g. "what can fill a room but takes up no space" vs the
  existing "what can fill an entire room but takes up no physical space" -
  both classic riddles independently landing on the same famous answer).
  All 5 were swapped for genuinely different riddles before anything was
  written to the database.
- Correctness of the 8 new math templates was verified separately and far
  more rigorously than eyeballing: a throwaway script generated 2,000
  level-3 math questions and re-derived the expected answer for each one
  independently (parsing the question text back out and recomputing),
  catching zero errors - but this process is what caught and fixed a real
  bug first: the dice-probability template's distractor options could
  collide with the correct answer's exact string value for a sum of 7,
  producing a duplicate option. Fixed by replacing the ad hoc distractor
  logic with a small lookup table of the 4 distinct possible reduced
  fractions (sums 4-10 only ever produce 3, 4, 5, or 6 ways out of 36),
  which makes a collision structurally impossible rather than just unlikely.
- Verified end-to-end against the real database: a throwaway Level 3 child
  played a full round pulling real bank content, confirmed
  `timeLimitSeconds: 100` and the new point values (14 base, 1.5x streak
  multiplier at 3+, +12 perfect-round bonus - a perfect round paid exactly
  113 points as hand-calculated) and confirmed no bonus-round UI appears
  (correct - level 3 is `MAX_LEVEL`, nothing above it). Separately, a
  throwaway Level 2 child with 3 backdated perfect rounds today correctly
  saw a bonus **Level 3** round offered on their dashboard and was able to
  start it and receive real level-3 content - confirming the v7 bonus
  mechanic generalized to the new top level exactly as designed, with no
  code changes of its own.

**v13 update - delight polish (confetti + sound):** per user request, the
quiz now celebrates: a small confetti burst + chime on every correct
answer, a bigger two-sided burst + a short fanfare on finishing a round,
and a rising multi-note fanfare specifically for a perfect round. A short
downward tone plays on a wrong answer too - not harsh, just enough
feedback to register "not quite" without being unpleasant for a kids' app.

- `canvas-confetti` is the one new runtime dependency added this whole
  project - a ~3kb, dependency-free, extremely widely used library. Worth
  a dependency here rather than hand-rolling canvas particle physics for a
  pure visual-polish feature; it has no server component and no cost.
- Sound is NOT an audio file - `lib/sound.ts` synthesizes short tones
  directly via the Web Audio API (a few sine-wave oscillators), so there's
  nothing to host and nothing that costs anything, consistent with every
  other $0-cost decision in this project.
- A mute toggle (`components/SoundToggle.tsx`) remembers its state in
  `localStorage` - a per-device preference, not something that needs to
  sync anywhere, so `localStorage` is the right tool rather than a new
  column on `children`.
- Verified in a real headless browser (not just "the build passed"): logged
  in as a throwaway kid, answered a real quiz question correctly, and
  captured a screenshot showing the confetti canvas actually rendering
  over the "Correct! +12 points" feedback card. Iterating on this test hit
  real flakiness from Neon's connection handling under the heavy load of a
  full day's testing (multi-second query times, occasional dropped
  connections) - a testing-environment artifact from this session's own
  volume of throwaway DB activity, not a defect in the app; noted here for
  the record rather than silently glossed over.

**v14 update - daily "checkup" (real understanding, not memorized
answers):** per user request, this goes further than v9's review round. A
review round replays the *exact* wrong question for free practice; a
checkup serves a *different* question testing the same skill, is mandatory
(gates a child's first standard round of the day whenever they have
something to recheck), and is scored normally - getting a genuinely
different question right is real evidence of understanding, so there's no
reason to withhold points for it.

- `rounds.kind` gains a third value, `'checkup'` (migration
  `009_daily_checkup.sql`), alongside two small additions needed to make
  "different but similar" possible at all:
  - `questions.concept` - an optional admin-set tag grouping bank questions
    that test the same underlying skill (e.g. "odd-one-out"). Untagged
    questions, or a skill with only one question, fall back to same-category.
  - `round_questions.template_key` - which of `lib/mathQuestions.ts`'s
    generator templates (now `{ key, run }` pairs instead of bare functions)
    produced a generated math question. Math has no fixed question identity
    to repeat, so a checkup instead regenerates from the *same template*
    with new random numbers via `generateMathQuestionByKey()` - same skill
    (e.g. "linear_equation"), different numbers.
- `lib/buildRound.ts`'s `buildCheckupQuestions()` finds each concept/template
  whose *latest* attempt was wrong (same "latest attempt" definition v9
  established, extended to cover generated questions via `template_key`
  instead of `question_id`), then builds a substitute for each: a different
  bank question sharing the concept tag (or category, as fallback) for bank
  questions, or a freshly-regenerated question from the same template for
  math. Capped at `MAX_CHECKUP_QUESTIONS` (5). Falls back to literally
  repeating a bank question only if there's truly nothing else to swap it
  for - better than skipping the recheck entirely.
- The gate lives in `POST /api/round/start`: before building any fresh
  standard round (any level, any mode except explicit review), it checks
  `lib/checkupProgress.ts`'s `getCheckupProgress()` and, if a checkup is due
  and not yet done today, serves that instead - transparently, regardless of
  what the client requested. The dashboard just relabels the existing "Start
  a quiz round" button to "🧠 Start today's checkup" when one is pending, so
  there's no separate flow for a kid to discover or skip.
- Scored normally (unlike review): the answer route's `isReview` short-
  circuit only checks for `kind === 'review'`, so a checkup round earns
  points, streak bonus, speed bonus, and the perfect-round bonus exactly
  like a standard round, with no code change needed there.
- Fixed a related latent gap while wiring this up: `lib/levelProgress.ts`'s
  bonus-unlock query counted *any* round at the child's base level today,
  including review rounds (variable length, unscored) - which could already
  inflate "rounds done today" and skew the accuracy math before this
  feature existed. Now filtered to `kind = 'standard'`, which fixes review's
  pre-existing exposure to this too, not just checkup's.
- Admin UI: `components/QuestionBank.tsx` gained an optional "Concept tag"
  field (with a badge on each question card) so tagging is opt-in and
  incremental - existing untagged questions keep working via the
  same-category fallback.

**v15 update - backups moved into this repo, encrypted:** per user request,
v11's "push the daily dump to a second, private repo" design is replaced.
The dump now lands in **this** (public) repo's own `backup/` folder -
`backup/<date>/backup-<time>.json.enc` - and an admin can also trigger one
on demand from the parent dashboard, not just wait for the daily schedule.
What makes committing a full, unredacted table dump (names, emails, hashed
PINs/passwords, kid photos) into a *public* repo acceptable is that it's
never written to disk, committed, or transmitted unencrypted: AES-256-GCM
under a single symmetric key (`BACKUP_ENCRYPTION_KEY`) the household
generates once and holds outside both GitHub and Vercel. This was a
deliberate reversal of v11's stated reasoning, confirmed explicitly with
the user (who considered and rejected both "keep it private" and "back up
everything except the sensitive fields" as alternatives) rather than
assumed.

- `lib/backupEncryption.ts` (`encryptBackup()`) is the app-side half - Node's
  built-in `crypto`, no new dependency, same as v11's "use what's already
  there" instinct. Output format is one self-contained base64 string per
  backup: a random 12-byte IV + the 16-byte GCM auth tag + the ciphertext,
  concatenated - nothing but the key itself is needed to decrypt it later.
  `scripts/backup.mjs` (the scheduled path) and `scripts/decryptBackup.mjs`
  (new - the only way back to readable JSON) duplicate this same ~10-line
  scheme directly rather than importing the `.ts` version, since they run as
  standalone Node scripts outside Next's build and can't resolve `@/lib/...`
  or strip TypeScript on their own - consistent with this project's general
  bias toward small duplication over forcing a shared-module dependency
  across two different runtimes.
- Two ways a backup happens now, both landing in the same place:
  - **Scheduled** (`'.github/workflows/backup.yml'`): simplified from v11,
    since the destination is now this same repo - drops the second
    checkout, `BACKUP_REPO`, and `BACKUP_REPO_TOKEN` entirely, and instead
    just needs `permissions: contents: write` on the workflow so its own
    built-in `GITHUB_TOKEN` can push. `scripts/backup.mjs` writes the
    encrypted file directly into the already-checked-out working tree,
    then a plain `git add backup/ && git commit && git push` step lands it.
  - **Admin-triggered** (`app/api/admin/backup/route.ts`, `requireAdmin()`
    guarded): the live app runs on Vercel, which has no local git checkout
    to push from at all, so a button click can't just shell out to `git`.
    Instead it authenticates as a fine-grained PAT (`GITHUB_BACKUP_TOKEN`,
    scoped to only this repo, Contents: read/write) and calls GitHub's
    Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) directly,
    which creates the commit server-side in one HTTP call - no git binary,
    no working directory, no separate checkout needed.
  - Both share `lib/backupTables.ts`'s table list (used directly by the
    route; duplicated in the two standalone scripts for the same reason as
    the encryption logic) and the same JSON shape (`{ manifest, tables }`
    with per-table row counts), so a decrypted file from either path reads
    identically regardless of which one produced it.
- Filenames are timestamped (`backup-143200.json.enc`, not just a date), so
  a manual backup never collides with - or silently overwrites - the same
  day's scheduled one.
- The key itself is intentionally the single point of trust: it lives in
  GitHub's repo secrets (scheduled path), Vercel's environment variables
  (admin-triggered path), and the household's own safe-keeping - never in
  the repo, and neither secret store lets it be viewed again after it's
  entered, only replaced. Losing it means every past backup becomes
  permanently unreadable; leaking it means every past backup becomes
  readable in one shot, since they all sit encrypted-but-present in public
  git history forever. Both are stated plainly in `docs/SETUP.md` rather
  than glossed over, since this is exactly the kind of irreversible
  tradeoff that shouldn't be a surprise later.
- Restore is still deliberately not built (same as v11) - `decryptBackup.mjs`
  gets you back to readable JSON; loading that into a live database remains
  a "build it if the day actually comes" item.

**v16 update - per-child report:** per user request, the parent dashboard's
per-child page (`/parent/children/[childId]`) gains a **Report** tab
alongside the existing raw question log - a plain-English "how is this kid
doing" writeup instead of a wall of individual answers. No schema change:
everything is derived from `round_questions`/`rounds`, which already record
enough to answer this.

- `lib/childReport.ts`'s `getChildReport()` is the one place all of it's
  computed. Deliberately looks at more than a single lifetime accuracy
  number:
  - **Category breakdown** over the last `REPORT_CATEGORY_WINDOW_DAYS` (30)
    days, not lifetime - a rough month from a while back shouldn't still be
    dragging down what a parent sees as "current."
  - **Trend**: last `REPORT_TREND_WINDOW_DAYS` (14) days vs. the 14 days
    before that, per category and combined - "is this actually working,"
    not just a snapshot.
  - **Weak spots**: the same admin-set `concept` tags and math
    `template_key`s the v14 checkup feature introduced, reused here for a
    different purpose - not "what to recheck tomorrow" but "what to tell a
    parent to work on with them." Only surfaces ones below 75% accuracy.
  - **Level readiness**: how many of the last `REPORT_LEVEL_READINESS_WINDOW_DAYS`
    (7) days a child actually played at their base level did they unlock
    the bonus round (same rule `lib/levelProgress.ts` uses for "today"),
    extended across a week - a nudge, not an automatic promotion; the
    parent still changes the level themselves.
  - A new `MIN_ATTEMPTS_FOR_WEAK_SPOT` (4) constant in `lib/config.ts`
    gates every one of the above - a category, concept, or trend needs at
    least that many attempts before it's allowed to be called a
    strength/weakness/direction at all, so one lucky or unlucky guess can't
    swing the read.
  - The whole thing degrades gracefully rather than erroring: a child with
    under 5 total answers gets `hasEnoughData: false` and a one-line "check
    back later" instead of a report built on noise; no bank questions
    tagged with a `concept` yet just means the weak-spots list leans on
    math skills alone (or is empty) rather than failing.
  - A short plain-English **summary** paragraph is generated from the same
    numbers (strongest/weakest category, the specific weak spot behind the
    weakest one if there is one, and the trend direction) - the one thing
    meant to be read first, with everything else as the supporting detail
    underneath it.
- `app/api/parent/children/[childId]/report/route.ts` reuses the exact same
  `ownedChild()` ownership check as the existing `.../log` route it sits
  next to - a parent sees only their own children's report, admin sees
  every child's.
- `components/ChildReport.tsx` is a new component; `components/ChildLog.tsx`
  gained a two-tab toggle ("📊 Report" / "📋 Full log") defaulting to
  Report, since a summary is more useful at a glance than 300 raw rows -
  the raw log is still one click away, unchanged.
- Verified against the real database (read-only, no throwaway data needed
  or cleaned up): pulled the report for an actual child with 35 answered
  questions, confirmed the returned accuracy math matched a hand-computed
  check against the raw rows (18/35 = 51%), confirmed the summary sentence
  read naturally, confirmed `trend` correctly reported "insufficient-data"
  for a child whose entire history is newer than the trend window (nothing
  to compare against yet) rather than a misleading 0%, and confirmed the
  auth guard 401s with no session and 404s for a child id that doesn't
  belong to the caller.
