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
public sign-up is closed. Each parent only sees/manages the children *they*
created; admin sees and manages everyone's, and is the only one who can
create a child under a parent other than themselves, manage the shared
question bank, or set a child's per-category priority weights.

## 5. Deploy to Vercel (free)

1. Push this repo to GitHub (public or private, free either way).
2. Go to https://vercel.com, "Add New… → Project".
   - If you're fine connecting your GitHub account to Vercel: import the
     repo the normal way - every future `git push` to the default branch
     then auto-deploys.
   - If you'd rather not link GitHub to Vercel at all (e.g. different
     account/identity), and your repo is **public**: paste the repo's URL
     into the "Ask v0 to build or enter a Git repository URL…" box on
     Vercel's New Project screen instead of using the "Import Git
     Repository" provider buttons below it - this clones the repo directly
     with no account connection. The trade-off: it's a one-time snapshot,
     not continuous deployment - after every future push, go to the
     project's Deployments tab and click **Redeploy** manually to pick up
     the new commit.
3. In the project's **Settings → Environment Variables**, add the same
   variables from your `.env.local`.
4. Deploy (or Redeploy, if you did the URL-paste import - the first deploy
   from that flow doesn't wait for env vars, so add them and redeploy once
   right after). You get a free `your-project.vercel.app` URL - no domain
   purchase needed.

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
entry per kid (name, an optional real photo or an emoji avatar, level, a
4-6 digit PIN they'll remember). If you're signed in as admin, you'll also
pick which parent the child belongs to. They pick their profile from the
home page and enter that PIN to play.

## 8. Automated backups (optional, but recommended, still free)

`.github/workflows/backup.yml` dumps every table daily and commits it
straight into **this repo**, at `backup/<date>/backup-<time>.json.enc`. This
repo is public, so that file is encrypted (AES-256-GCM) before it's ever
written to disk - without the key below, it's unreadable noise to anyone
browsing the repo. Until you do this setup, the scheduled workflow runs and
safely no-ops (a skipped run with a warning in the Actions tab); the admin
"Back up now" button (see below) shows a clear error instead of failing
silently. The app itself is unaffected either way.

1. Generate the encryption key **once**:
   ```bash
   openssl rand -base64 32
   ```
   Save that value somewhere safe outside GitHub/Vercel entirely (a password
   manager is ideal) **right now** - both of the places it goes next are
   write-only. If you ever lose your own copy, every backup ever taken
   becomes permanently unreadable; there is no recovery.
2. In **this** repo's **Settings → Secrets and variables → Actions**, add
   two repository secrets:
   - `DATABASE_URL` - the same pooled connection string from step 1 (GitHub
     Actions can't see your Vercel environment variables, so this needs to
     be added here too).
   - `BACKUP_ENCRYPTION_KEY` - the value from step 1.

   That's enough for the **daily automatic** backup - it now runs entirely
   inside GitHub Actions using its own built-in permission to push to this
   repo, no extra token needed. You can also trigger it manually from this
   repo's **Actions** tab any time ("Run workflow").

3. For the **admin "Back up now" button** in the parent dashboard to work
   too, add two more environment variables in **Vercel → your project →
   Settings → Environment Variables**:
   - `BACKUP_ENCRYPTION_KEY` - the exact same value from step 1 (the button
     and the scheduled workflow must use the same key, since either one
     might need to decrypt what the other produced later).
   - `GITHUB_BACKUP_TOKEN` - a fine-grained personal access token
     (https://github.com/settings/personal-access-tokens/new) scoped to
     **only this repo**, with **Contents: Read and write** permission and
     nothing else. This is what lets a click on the website actually create
     a commit, since the running app has no local git checkout to push
     from.
4. Redeploy on Vercel after adding those (see "Deploying a change" above)
   so the new environment variables take effect.

Each backup run adds one encrypted file under `backup/<date>/` - dated
folders, timestamped filenames so a manual backup never collides with the
scheduled one on the same day.

**Reading a backup back:**
```bash
BACKUP_ENCRYPTION_KEY=<your key> node scripts/decryptBackup.mjs backup/2026-09-18/backup-191500.json.enc
```
This writes the decrypted JSON next to the input file. There's no
one-command restore-into-Postgres script yet, since it's never been needed;
ask for one if the day comes.

## Rebalancing the game later

Every point value, timer, and default reward lives in one file:
`lib/config.ts`. Change a number there and redeploy (see "Deploy to
Vercel" above for what redeploying actually means for your setup).

For finer per-child tuning without touching code: sign in as admin, open a
child's page from the dashboard, and adjust their per-category priority
weights, or manage individual questions from the **Question Bank** page.
