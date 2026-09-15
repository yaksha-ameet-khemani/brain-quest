# Setup - $0 cost, start to finish

Every step below uses a free tier. None require a credit card, and none will
ever charge you unless you deliberately upgrade a plan later.

## 1. Create the Supabase project (free)

1. Go to https://supabase.com, sign up, "New project".
2. Pick any name/region/password (save the DB password somewhere safe - you
   won't need it day-to-day, Supabase manages the connection for you).
3. Once it's ready, open **Project Settings → API** and copy:
   - `Project URL` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is `SUPABASE_SERVICE_ROLE_KEY` (**never** put
     this one in `NEXT_PUBLIC_*`, never commit it, never send it to the
     browser - it bypasses every security rule in the database)

## 2. Load the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the contents of `supabase/schema.sql`, run it.
3. Paste the contents of `supabase/seed.sql`, run it (adds the starter
   question bank and reward catalog).

## 3. Turn off public sign-ups (important)

By default anyone who finds your Vercel URL could create a Supabase Auth
account and hit `/parent`. Since this app is a single household, lock it
down after creating your one parent account:

1. Run the app locally or on Vercel, go to `/login/parent`, "First time?
   Create your parent account", sign up with your real email.
2. Confirm the email (Supabase sends a confirmation link).
3. Back in the Supabase dashboard: **Authentication → Settings → disable
   "Allow new users to sign up"**.

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- The three Supabase values from step 1.
- `KID_SESSION_SECRET`: run `openssl rand -hex 32` and paste the output.
- `APP_TIMEZONE`: an IANA timezone name (e.g. `Asia/Kolkata`), used to decide
  when a new day starts for the daily-round limit.
- `KEEPALIVE_SECRET`: any random string, used in step 6.

Run locally:

```bash
npm install
npm run dev
```

## 5. Deploy to Vercel (free)

1. Push this repo to a **private** GitHub repo (free).
2. Go to https://vercel.com, "Add New… → Project", import the repo.
3. In the project's **Settings → Environment Variables**, add the same
   variables from your `.env.local` (all of them, including the service role
   key - Vercel env vars are server-side and never shipped to the browser
   unless prefixed `NEXT_PUBLIC_`).
4. Deploy. You get a free `your-project.vercel.app` URL - no domain purchase
   needed. Every future `git push` to the default branch auto-deploys.

## 6. Keep Supabase from pausing (free)

Supabase free projects pause after ~7 days with zero activity. A tiny GitHub
Actions workflow (`.github/workflows/keepalive.yml`, already in this repo)
pings the app weekly to prevent that, using GitHub's free Actions minutes.

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
