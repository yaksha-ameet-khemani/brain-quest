# 🧠 Brain Quest - Kids Logic & Reward Quiz

A home web app: kids answer logic, math, riddle, and spatial questions,
earn points, and redeem them for real rewards a parent approves. Built to
run at **$0 cost, forever**, on free tiers only - no paid service anywhere
in the stack, ever.

- **Live**: https://brain-quest-omega.vercel.app
- **Setup / deployment**: see [`docs/SETUP.md`](docs/SETUP.md) - a complete,
  no-cost walkthrough from Neon project creation to a live Vercel URL.
- **Design decisions, the economy, and every change since v1**: see
  [`docs/blueprint.md`](docs/blueprint.md) - a versioned log of what changed
  and why, kept up to date as the app evolves. Read that before making
  changes here.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, a plain Postgres database
(Neon's free tier, accessed via `pg` - not locked to Neon specifically, any
Postgres host with a connection string works), deployed on Vercel.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your database connection string and secrets
npm run dev
```

Open http://localhost:3000.

## How it works, in short

**Accounts & roles**
- The first parent account ever created becomes **admin**, permanently -
  public sign-up closes the instant it exists. Every other parent account
  is created *by* the admin, from the dashboard.
- A parent manages only their own children; admin manages everyone's, and
  is the only one who can create/remove parent accounts or manage the
  shared question bank.
- **Kids** pick their profile (photo or emoji avatar) and enter a short PIN
  - no email needed.

**Security**
- Every quiz question is graded **server-side** - the browser never
  receives a correct answer until after that question has been answered.
- The database connection string (which can read everything) never leaves
  the server; there is no public API key of any kind.
- Points are an append-only ledger, not an editable number - a balance is
  always the sum of that child's transactions.

**Content**
- Three levels: 1 (younger), 2 (older), 3 (most advanced) - a parent assigns
  a child's level, and admin can change it any time.
- Math questions are generated from templates (`lib/mathQuestions.ts`) so
  they never run out; logic/riddle/spatial questions come from a curated,
  hand-verified bank (180 questions - 20 per level per category, across all
  3 levels) that admin manages from an in-app **Question Bank** page,
  including each question's live "proficiency" (attempts/correct/success
  rate).
- Admin can set a per-child, per-category priority weight (e.g. give a kid
  more logic practice if that's their weak spot), which steers what shows
  up in that child's rounds.
- A child who finishes all of a day's rounds with better than 75% accuracy
  unlocks 3 bonus rounds at the next level up, for that day - a repeatable
  daily stretch-goal, not a permanent level change. (A Level 3 child is
  already at the top, so this doesn't apply to them.)
- A child can replay questions they most recently got wrong in a one-a-day
  "review round" - pure practice, never scored and never counted against
  the daily round limit. Getting one right on review retires it; getting it
  wrong again keeps it coming back.
- Before their first standard round each day, a child with recent wrong
  answers gets a mandatory "checkup" - a short, normally-scored round of
  DIFFERENT questions on the same skill (a different bank question tagged
  with the same admin-set concept, or a freshly-generated math question
  from the same template with new numbers), so getting it right is real
  evidence of understanding rather than memorizing the exact question.
- A dashboard badge recognizes daily/weekly play streaks ("🔥 4 day streak
  · 🗓️ 1 week streak") - no extra mechanic, just showing up consistently
  gets noticed.
- Confetti and short synthesized sound effects (no audio files - generated
  in-browser via the Web Audio API) celebrate correct answers and finished
  rounds, with a bigger celebration for a perfect round. A 🔊/🔇 toggle on
  the quiz screen remembers its state per-device.

**Visibility**
- The homepage is just the child picker and a Parent Mode link - no activity
  data is shown there or anywhere without signing in.
- A signed-in parent sees their own children's full detail: every question
  ever asked, what was picked, right or wrong, and how long it took.
- Admin additionally sees a cross-child "Family activity" summary (last
  login, attempted/correct/wrong, time played) for every kid at once, plus
  an admin-only "reset activity" per child for testing, which never touches
  the child's profile/PIN.

**Backups**
- `.github/workflows/backup.yml` dumps every table to JSON daily, pushed
  into a second, separate, **private** GitHub repo (never this one, since
  this repo is public and a dump contains family PII). Needs a one-time
  setup only the account owner can do - see `docs/SETUP.md`'s "Automated
  backups" section. Until that's done, the workflow safely no-ops.

## Project structure

```
app/                 Pages (App Router) and API route handlers
  api/               Server-only endpoints - grading, points, redemptions, admin actions
  kid/[childId]/     PIN entry
  dashboard/         Kid home screen - points, round access, bonus-level progress
  quiz/              The quiz flow
  rewards/           Catalog + redemption requests
  login/parent/      Parent sign-in / sign-up
  parent/            Parent dashboard, question bank, per-child detail + settings
components/          Shared client components
lib/                 Config, database access, auth, question generation, level progress
db/                  schema.sql + seed.sql (fresh install) + migrations/ (applied-to-prod history)
scripts/             backup.mjs - dumps every table to JSON (used by the backup workflow)
docs/                Setup guide and the versioned blueprint/design doc
.github/workflows/   Free weekly keep-alive ping + daily database backup
```

## Deploying a change

Vercel is **not** connected to this GitHub repo via its normal Git
integration (deliberately, to avoid linking a different account identity),
so `git push` does **not** auto-deploy. After pushing, check Vercel's
Deployments tab and manually hit **Redeploy** if a new build hasn't started
on its own.
