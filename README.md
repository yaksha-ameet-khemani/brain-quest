# 🧠 Brain Quest - Kids Logic & Reward Quiz

A home web app: kids answer logic, math, riddle, and spatial questions,
earn points, and redeem them for real rewards a parent approves. Built to
run at **$0 cost, forever**, on free tiers only.

- **Setup / deployment**: see [`docs/SETUP.md`](docs/SETUP.md) - a complete,
  no-cost walkthrough from Neon project creation to a live Vercel URL.
- **Design decisions & the economy**: see [`docs/blueprint.md`](docs/blueprint.md).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, a plain Postgres database
(Neon's free tier, accessed via `pg` - not locked to Neon specifically, any
Postgres host with a connection string works), deployed on Vercel. No paid
service anywhere in the stack.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your database connection string and secrets
npm run dev
```

Open http://localhost:3000.

## How it works, in short

- **Kids** pick their profile and enter a short PIN (no email needed).
- **The parent** signs in with an email+password account created on first
  use - sign-ups close automatically once that one account exists.
- Every quiz question is graded **server-side** - the browser never receives
  a correct answer until after that question has been answered, and the
  database connection string (which can read everything) never leaves the
  server; there is no public API key of any kind.
- Points are an append-only ledger, not an editable number - a balance is
  always the sum of that child's transactions.
- Math questions are generated from templates (`lib/mathQuestions.ts`) so
  they never run out; logic/riddle/spatial questions come from a curated,
  hand-verified bank (`db/seed.sql`) that a parent can extend by SQL.

## Project structure

```
app/                 Pages (App Router) and API route handlers
  api/               Server-only endpoints - grading, points, redemptions
  kid/[childId]/     PIN entry
  dashboard/         Kid home screen
  quiz/              The quiz flow
  rewards/           Catalog + redemption requests
  login/parent/      Parent sign-in / sign-up
  parent/            Parent dashboard - approvals, analytics, add a child
components/          Shared client components
lib/                 Config, database access, auth, question generation
db/                  schema.sql + seed.sql - run these against your Postgres database
docs/                Setup guide and the blueprint/design doc
.github/workflows/   Free weekly keep-alive ping for the database's free tier
```
