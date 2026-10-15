# Environments

How a change travels: your laptop → the **dev** site → the **live** site.
Three environments, three databases, and a different way into each.

| | local | dev (demo site) | prod (live site) |
|---|---|---|---|
| Git | any branch | `dev` | `main` |
| Site | `http://localhost:3000` from `node server.js` | `https://dev.<pages-project>.pages.dev` | `https://<pages-project>.pages.dev` |
| Database | Supabase CLI in Docker | Supabase project `gxgfzafrxulzltikdkca` | a **separate** Supabase project, created by a human (PR 3) |
| Data | `seed.sql` — three fake households | the same three fake households | real. Never seeded. |
| Sign-in | emailed link → Mailpit; Google if configured | Google | Google |
| Deployed by | you, with `npm run dev` | GitHub Actions on every push to `dev` | GitHub Actions on every push to `main`, after a named reviewer approves |
| Who can change the database by hand | you | Alex, via Studio or the MCP | **nobody.** Break-glass only (PR 3) |

**How the browser knows which database to use:** `public/config.js` looks at
the page's hostname. `localhost` → local. The exact prod hostname → prod.
*Anything else* → dev. A typo or an unknown host can only ever reach dev.

**What the agent can and cannot do:** everything in this file that says
*Human* needs a dashboard login — Supabase, Cloudflare, Google Cloud or
GitHub settings. The agent has none of those and must never be given a
secret. It writes the workflows and this checklist; a person turns the knobs.

---

## Local

Nothing to set up beyond Node 22 and Docker Desktop. See README "Run it".

The keys in `public/config.js` for `local` are the Supabase CLI's fixed demo
values. They are the same on every machine and are public by design.

---

## Dev — the demo site

Everything below is done once. Tick each box in the PR that lands it.

### 1. Cloudflare — *Human*

- [ ] Create a Cloudflare account (free plan is fine) if there isn't one.
- [ ] Note the **Account ID**: Cloudflare dashboard → Workers & Pages → the
      right-hand sidebar, or the URL `dash.cloudflare.com/<account-id>/...`.
- [ ] Create the Pages project as **Direct Upload** (not connected to Git —
      the workflow does the uploading, so the database can go first):
      Workers & Pages → Create → Pages → *Upload assets* → name it
      `sub-for-santa` → create, then skip the upload. If the name is taken,
      pick another and use it everywhere `<pages-project>` appears below.
- [ ] Project → Settings → Builds & deployments → **Production branch:
      `main`**. This makes `dev` deploys *previews* at
      `https://dev.<pages-project>.pages.dev` and `main` deploys the real
      site at `https://<pages-project>.pages.dev`.
- [ ] Create an API token: My Profile → API Tokens → Create Token → *Create
      Custom Token* → Permissions: **Account · Cloudflare Pages · Edit**,
      Account Resources: the one account. Nothing else. Copy it once; it is
      shown once.

### 2. Supabase (existing dev project `gxgfzafrxulzltikdkca`) — *Human*

- [ ] Personal access token: supabase.com → Account → Access Tokens →
      Generate new token → name it `github-actions-dev`.
- [ ] Database password: Project → Project Settings → Database. If nobody has
      it, *Reset database password* and copy the new one.
- [ ] Authentication → URL Configuration:
  - **Site URL:** `https://dev.<pages-project>.pages.dev`
  - **Redirect URLs** (add all three):
    - `https://dev.<pages-project>.pages.dev/**`
    - `https://*.<pages-project>.pages.dev/**` — PR previews
    - `http://localhost:3000/**` — the `SUPABASE_TARGET=dev npm start` escape hatch
- [ ] Authentication → Sign In / Providers:
  - **Email: OFF.** The emailed link exists on laptops only.
  - **Google: ON**, with the *dev* OAuth client from step 3 below.
  - Everything else: off.

### 3. Google Cloud — a separate OAuth client for dev — *Human*

Dev gets its own client so its test-user list stays apart from prod's.

- [ ] APIs & Services → Credentials → Create credentials → OAuth client ID →
      *Web application* → name `Sub for Santa (dev)`.
- [ ] **Authorized JavaScript origins:**
      `https://dev.<pages-project>.pages.dev` and `http://localhost:3000`.
- [ ] **Authorized redirect URI:**
      `https://gxgfzafrxulzltikdkca.supabase.co/auth/v1/callback`
- [ ] Copy the client ID and secret into Supabase → Authentication →
      Providers → Google (step 2).
- [ ] While the consent screen is in *Testing*, add the admin's Google
      account (and Alex's) under **Test users**.

### 4. GitHub — repository settings — *Human*

- [ ] Settings → Environments → **New environment: `development`**. No
      protection rules; dev deploys on every push.
- [ ] In that environment, add **Environment secrets**:

  | Secret | Value |
  |---|---|
  | `SUPABASE_ACCESS_TOKEN` | the personal access token from step 2 |
  | `SUPABASE_DB_PASSWORD` | the dev project's database password |
  | `CLOUDFLARE_API_TOKEN` | the Pages-edit token from step 1 |
  | `CLOUDFLARE_ACCOUNT_ID` | the account ID from step 1 |

- [ ] And **Environment variables** (plain, not secret):

  | Variable | Value |
  |---|---|
  | `SUPABASE_PROJECT_REF` | `gxgfzafrxulzltikdkca` |
  | `CLOUDFLARE_PAGES_PROJECT` | `sub-for-santa` (or whatever step 1 ended up as) |
  | `SITE_URL` | `https://dev.<pages-project>.pages.dev` — shown on the deployment in GitHub |

- [ ] Settings → General → **Default branch: `dev`**. Feature branches open
      pull requests into `dev`; `main` only ever receives `dev` (PR 3).
- [ ] Settings → Actions → General → Workflow permissions: *Read repository
      contents and packages permissions* is enough. Nothing here writes to
      the repo.

### 5. Verify — *Human*

- [ ] Push (or merge) to `dev`. Actions → *Deploy dev* goes green, with
      "Apply migrations" before "Upload".
- [ ] Open `https://dev.<pages-project>.pages.dev`. The page loads with no
      console errors, and **no "Email me a sign-in link" form** — only
      Google.
- [ ] Sign in with Google. The queue at `/queue.html` shows the three fake
      households (the admin `profiles` row already exists on this project
      for the admin's account; `supabase/README.md` covers adding one).
- [ ] Open a PR into `dev` from a branch in this repo. *PR preview* deploys
      `https://pr-<n>.<pages-project>.pages.dev`, and signing in there works
      because of the wildcard redirect URL.
- [ ] Browser devtools → Network → the page's response headers include
      `content-security-policy` and `x-content-type-options: nosniff`.

### Things that must stay true

- `supabase config push` is **never** run against this project. It would
  switch the email provider on. Schema travels as migrations only.
- `seed.sql` is never run here by the workflow (`db push` has no
  `--include-seed`). The three fake rows that exist today were inserted by
  hand and are fine to keep until the referral form lands.
- `.mcp.json` points at this project and no other. It is deleted before the
  app is reachable by anyone outside Alex and the admin — Nov 6 at the latest
  (`CLAUDE.md`).

---

## Prod — the live site

Written in PR 3. Until then there is no prod: `PROD_HOSTNAME` in
`public/config.js` is `null`, and nothing can resolve to it.
