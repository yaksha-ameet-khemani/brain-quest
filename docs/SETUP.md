# Setup - $0 cost, start to finish

Every step below uses a free tier, none requiring a credit card. (The app was
originally designed around Supabase; it now uses Neon for the database
instead, since Supabase caps free accounts at 2 projects. Everything else -
Vercel, GitHub - is unchanged. See `docs/blueprint.md` for why.)

## 1. Create the Neon project (free)

1. Go to https://neon.tech, sign up, create a new project.
2. Pick any name/region.
3. Once it's ready, open the project's **Connection Details** panel and copy
   the **pooled connection string** (it usually has `-pooler` in the
   hostname, and a `?sslmode=require` suffix). That whole string is your
   `DATABASE_URL`.

## 2. Load the database schema

Using the **SQL Editor** in the Neon dashboard (or `psql "$DATABASE_URL" -f db/schema.sql` from a terminal that has `psql` installed):

1. Run `db/schema.sql`.
2. Run `db/seed.sql` (adds the starter question bank and reward catalog).

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL`: the pooled connection string from step 1.
- `KID_SESSION_SECRET` and `PARENT_SESSION_SECRET`: run `openssl rand -hex 32`
  **twice** and paste each output into its own variable - they must be
  different from each other.
- `APP_TIMEZONE`: an IANA timezone name (e.g. `Asia/Kolkata`), used to decide
  when a new day starts for the daily-round limit.
- `KEEPALIVE_SECRET`: any random string, used in step 6.

Run locally:

```bash
npm install
npm run dev
```

## 4. Create your admin account

Open `/login/parent` and create your account (email + password, at least 8
characters). **The very first account created becomes the admin, forever** -
the moment it exists, public sign-up closes automatically (enforced by the
app itself, no dashboard setting to remember) and the admin account can
never be deleted through the app. There's no email confirmation step, since
there's no email service in this $0 stack; that's fine for a private
household app.

Need another parent to have their own login (e.g. a spouse)? Sign in as
admin, go to **🛡️ Manage parent accounts** on the dashboard, and add them
there - that's the only way a second parent account gets created, since
public sign-up is closed. Admin and parent accounts see the same
child data (all parents share one pool of children); the admin's only extra
power is managing other parent accounts.

## 5. Deploy to Vercel (free)

1. Push this repo to a **private** GitHub repo (free).
2. Go to https://vercel.com, "Add New… → Project", import the repo.
3. In the project's **Settings → Environment Variables**, add the same
   variables from your `.env.local`.
4. Deploy. You get a free `your-project.vercel.app` URL - no domain purchase
   needed. Every future `git push` to the default branch auto-deploys.

## 6. Keep the database from going idle (free)

Neon's free tier auto-suspends an idle database's compute after a short
period of inactivity - normally invisible, since the next query just waits a
moment for it to wake up. A tiny GitHub Actions workflow
(`.github/workflows/keepalive.yml`, already in this repo) pings the app
weekly as a hedge against any longer-term "inactive project" policy, using
GitHub's free Actions minutes.

1. In your GitHub repo: **Settings → Secrets and variables → Actions**.
2. Add two repository secrets:
   - `APP_URL` = your Vercel URL (e.g. `https://your-project.vercel.app`)
   - `KEEPALIVE_SECRET` = the same value you put in the app's env vars
3. That's it - it runs automatically every Monday. You can also trigger it
   manually from the repo's **Actions** tab any time ("Run workflow").

## 7. Add your kids

Sign in at `/login/parent`, scroll to "Add a child profile", and create one
entry per kid (name, avatar emoji, level, a 4-6 digit PIN they'll remember).
They pick their profile from the home page and enter that PIN to play.

## Rebalancing the game later

Every point value, timer, and default reward lives in one file:
`lib/config.ts`. Change a number there, redeploy (push to GitHub - Vercel
picks it up automatically), done.
