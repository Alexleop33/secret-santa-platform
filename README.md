# Sub for Santa — Platform

The code for a holiday gift-matching drive for a nonprofit. Caseworkers refer
households; a coordinator approves them; donors browse anonymized listings and
sponsor a household.

**Requirements don't start here.** They start as Stories in
[secret-santa-product](https://github.com/Alexleop33/secret-santa-product).
An Epic whose parent Story isn't Ready gets closed.

## Ground rules

- **No family PII.** No names, addresses, or phone numbers for referred
  households — not in the DB, URLs, logs, or CSV exports. A household is a
  reference code and a story. No photos, ever.
- **RLS on every table from the first migration.** Default deny. No table
  ships without a policy and a test proving denial.
- **This repo is public on purpose.** Nothing in source control that would
  be embarrassing to a stranger: no real data, no secrets, no prod dumps.
  Seeds are synthetic. Sandbox and prod are separate projects with separate
  keys.
- **Never roll our own auth.** Donors sign in by emailed magic link.
- **No payments, ever.** The app never handles money. No Stripe link, no card
  data, no cash — donors buy gifts and drop them off.
- **The app must never be the single point of failure.** If it breaks in
  December, the coordinator falls back to a spreadsheet and gifts still get
  delivered. Roster CSV export is a safety feature, not a report.

## Run it

You need two things installed: **Node 22** and **Docker Desktop** (running).
No Supabase, Google or Cloudflare account.

```
git clone https://github.com/Alexleop33/secret-santa-platform
cd secret-santa-platform
npm install
npm run dev
```

The first run pulls a few Docker images, so give it a couple of minutes.
Then:

1. Open <http://localhost:3000> and use **"Email me a sign-in link"**. The
   email doesn't go anywhere — open **Mailpit** at <http://127.0.0.1:54324>
   and click the link there.
2. Make that account the admin: `npm run make-admin -- you@example.test`
   (the same address you just used).
3. Reload <http://localhost:3000/queue.html>. Three fake households are
   waiting for review.

What `npm run dev` does, in order: checks Docker is up → `supabase start`
(Postgres, Auth, REST API, Mailpit, as containers) → `supabase db reset`
(every migration, then `supabase/seed.sql`) → `node server.js`. The database
is wiped and rebuilt on every run — that's deliberate. What you see is always
what the migrations say, and nothing you type locally can leak anywhere.

| Command | What it does |
|---|---|
| `npm run dev` | The whole app, locally. Ctrl-C stops the web server only |
| `npm run db:stop` | Stops the containers |
| `npm run make-admin -- you@example.test` | Makes a local account the admin |
| `npm test` | Unit tests (`node --test`) |
| `npm run test:db` | RLS denial tests (pgTAP) against the local database |
| `SUPABASE_TARGET=dev npm start` | Local pages against the **hosted dev** project. The exception, not the default — sign-in is Google there, and the email button won't appear |

The Supabase CLI is a pinned `devDependency`, so there is nothing to install
globally. Sign-in by email exists on the local database **only**; both hosted
projects keep it switched off and use Google.

## Environments

Your laptop runs against a database in Docker. The `dev` branch deploys to a
demo site on the sandbox Supabase project. `main` deploys to the live site
on a separate project that is never seeded and never edited by hand. The
browser picks its database from the page's hostname, and anything it doesn't
recognise goes to dev — never prod. A release is a pull request from `dev`
into `main` that a code owner approves, and the deploy itself waits for a
named reviewer. Nobody changes the live database by hand; the one exception
is written down in [docs/break-glass.md](docs/break-glass.md). The full map,
and every console step a human has to do, is in
[docs/environments.md](docs/environments.md).

## How work arrives

```
Story (product repo, Ready)  →  Epic (here)  →  branch  →  PR  →  UAT  →  Done
```

One **vertical slice** at a time: schema + policy + API + UI + a test, for
ONE user action. Not "the donor side."

Every PR needs a closing keyword or CI fails:

```
Closes Alexleop33/secret-santa-product#12
```

## Stack

Decided 2026-10-11. `CLAUDE.md` carries the reasoning behind each line.

| Layer | Choice | Why |
|---|---|---|
| Front end | Plain HTML, CSS, JavaScript | No framework, no TypeScript — Alex can read every line. A bundler is case by case, see CLAUDE.md |
| Database | Postgres with row-level security | The database refuses the wrong reader, rather than the app remembering to |
| Login | Google sign-in | No passwords stored. Hosted projects are Google-only; the local Docker database also accepts an emailed link, so a fresh clone can sign in. Families still have no login |
| Host | Supabase, for now | Carries the session and the RLS bridge; the anon key is public, so RLS is load-bearing |
| Deploy | Cloudflare Pages, uploaded by GitHub Actions | `dev` → demo site, `main` → live site, database migrated first in the same workflow. See [docs/environments.md](docs/environments.md) |

## Data model sketch

Everything hangs off `campaigns` — no `organizations` table above it.

| Table | Columns |
|---|---|
| `campaigns` | name, year, the three dates, status |
| `households` | campaign_id, ref_code, story, status |
| `household_members` | household_id, age, gender, notes — **no names** |
| `wish_items` | household_id, label |
| `claims` | household_id, donor_id, status, claimed_at, released_at |
| `users` | email, role |
| `activity` | campaign_id, actor, action, target, timestamp |

## Deadlines

| Date | Event |
|---|---|
| **Nov 6, 2026** | Nominations close — caseworker + coordinator flows live |
| **Nov 30, 2026** | Donor claims close |
| **Dec 14, 2026** | Gifts due |

Phase one is caseworker referral + coordinator approval. Donor claiming lands
after Nov 6.
