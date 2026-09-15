# Brain Quest - Blueprint (v2)

This revises `Kids Logic & Reward Quiz Web Application Blueprint.docx` (the
original spec) based on a security/gameplay review. The changes are called
out explicitly below so it's clear what moved and why. This file is the
living reference going forward - the .docx is kept for history.

## Goal

A home web app for the family's kids: logic/math/riddle quizzes, earn points
for correct answers, redeem points for real rewards. Zero ongoing cost.

## What changed from the original doc, and why

1. **Answers never reach the browser.** The original stored
   `correct_option_index` in a table the client would read directly, and
   shipped a "local fallback JSON" of every question+answer to the browser.
   Any kid who opens DevTools finds the answer key in minutes. Now: the
   browser only ever talks to our own Next.js API routes, which use the
   Supabase **service role key** (server-only, never sent to the client) to
   grade answers and never include `correct_index`/`explanation` in a
   response until *after* that question is answered.

2. **Points are a ledger, not a mutable column.** `point_transactions` is
   append-only; a balance is `SUM(amount)`. This makes the balance
   tamper-resistant (nothing writes it directly) and gives a full audit
   trail ("where did my points come from?").

3. **Real auth for the parent, PIN for kids.** The parent has an actual
   Supabase Auth account (email+password). Kids pick their profile and type
   a short PIN (hashed with scrypt, rate-limited 5 tries/minute) - enough
   friction for a family app without needing an email account per 9-year-old.

4. **Schema fixes:**
   - Parents are no longer rows in the same table as kids (that made the old
     schema's `grade_level NOT NULL` constraint impossible to satisfy for a
     parent row). Parents are `auth.users`; kids are a separate `children`
     table.
   - `level` (1/2) replaces `grade_level` (4/8) so the app doesn't need a
     migration every September.
   - `redemptions.status` now has a real lifecycle: `pending → approved/denied
     → fulfilled`, and denying refunds the points automatically.
   - Every table has RLS enabled with **zero policies** - the anon/authenticated
     roles can read or write nothing directly. This is a deliberate,
     simpler alternative to writing per-table RLS policies: since 100% of
     game logic goes through our server routes with the service-role key,
     there is nothing for the anon key to legitimately touch.

5. **Content never runs out.** The original 20-question bank would be
   exhausted in a single day of max play. Math questions are now generated
   from templates at request time (`lib/mathQuestions.ts`) - effectively
   infinite variety. Logic/riddle/spatial stay as a curated, hand-verified
   bank (`supabase/seed.sql`), with recently-served questions avoided when
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

10. **Free-tier caveat documented, not silently assumed:** Supabase free
    projects pause after ~7 days idle. `.github/workflows/keepalive.yml`
    (also free) pings the app weekly to prevent that. See `docs/SETUP.md`.

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

See `supabase/schema.sql` for the authoritative version, with comments.
Summary: `children`, `questions` (curated bank), `rounds` +
`round_questions` (frozen per-serving snapshot, including shuffled option
order and the answer - readable only server-side), `point_transactions`
(the ledger), `rewards`, `redemptions`.

## Stack

Next.js 14+ (App Router) + TypeScript + Tailwind, hosted on Vercel's free
tier (`*.vercel.app`, no domain purchase needed). Supabase free tier
(Postgres + Auth). GitHub free private repo. No paid API, SMS, or email
service anywhere in the stack - see `docs/SETUP.md` for the full free-tier
walkthrough and its one caveat (the idle-pause behavior above).

## Deliberately out of scope for v1

- Multi-family/multi-tenant support (this is a single-household app - every
  child in the table shows on the picker screen, by design).
- A parent UI for editing/deactivating individual bank questions (they can be
  added via `supabase/seed.sql` or a direct SQL insert for now; `POST
  /api/rewards` exists for the reward catalog, an equivalent for questions is
  a reasonable next step if the seeded bank needs expanding).
- Spaced-repetition review of missed questions (flagged as a good addition
  later - the biggest single learning lever, deliberately deferred to keep
  v1 shippable).
