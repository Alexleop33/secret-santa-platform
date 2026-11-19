# Environments

How a change travels: your laptop → the **dev** site → the **live** site.
Three environments, three databases, and a different way into each.

| | local | dev (demo site) | prod (live site) |
|---|---|---|---|
| Git | any branch | `dev` | `main` |
| Site | `http://localhost:3000` from `node server.js` | `https://dev.<pages-project>.pages.dev` | `https://<pages-project>.pages.dev` |
| Database | Supabase CLI in Docker | Supabase project `wiobafdpmzzrzzqavjbf` | a **separate** Supabase project in its own organization, created by a human |
| Data | `seed.sql` — three fake households | the same three fake households | real. Never seeded. |
| Sign-in | emailed 6-digit code → Mailpit; Google if configured | emailed 6-digit code (once email §1–§4 below is done); Google as a second option until turned off | same as dev |
| Deployed by | you, with `npm run dev` | GitHub Actions on every push to `dev` | GitHub Actions on every push to `main`. The review happens on the `dev` → `main` pull request, not at the deploy |
| Who can change the database by hand | you | Alex, via Studio or the MCP | **nobody.** [Break-glass](break-glass.md) only |

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

### 2. Supabase (dev project `wiobafdpmzzrzzqavjbf`, "sub-for-santa-dev", in David's org) — *Human*

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
    - and the bare forms `https://*.<pages-project>.pages.dev` and
      `http://localhost:3000`. The `/**` pattern does not match an origin
      with no path, and the first preview fell back to the Site URL because
      of it. `auth.js` now sends `origin/`, which `/**` does match, so the
      bare forms are belt and braces.
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
      `https://wiobafdpmzzrzzqavjbf.supabase.co/auth/v1/callback`
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
  | `SUPABASE_PROJECT_REF` | `wiobafdpmzzrzzqavjbf` |
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
      console errors. It offers whichever sign-in the project has switched
      on: Google until the *Email sign-in* section below is done, the email
      code after.
- [ ] Sign in with Google once, then add the admin `profiles` row for that
      account (`supabase/README.md`). This project started empty: the
      first Deploy dev applied the migrations and nothing else. To see the
      three fake households on the demo site, run `supabase/seed.sql` by
      hand in the dev project's SQL editor (dev is not prod; fake rows are
      fine here). Then `/dashboard.html` shows them.
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

Real families' referrals land here. Everything below is done **once**, by a
human, and ticked in PR 3. The rule afterwards: **nobody changes prod by
hand.** Code reaches it only through a reviewed `dev` → `main` pull request and the deploy that follows. Data
changes by hand only through [break-glass.md](break-glass.md).

### 1. Supabase — a new project in its own organization — *Human (David, for now)*

- [ ] supabase.com → **New organization**, named for the nonprofit's drive
      (not a person's). Prod lives alone in it: a separate org means a
      separate member list and a separate bill, so a mistake in the sandbox
      org can't touch it. **Decided 2026-10-16:** the org lives under
      David's accounts for now, so the setup could happen before Alex was
      available, and is transferable to Alex; the product repo's
      `decisions.md` carries the line.
- [ ] **Plan:** Pro is recommended — the free plan **pauses projects after a
      week of inactivity**, and this one must be awake from the first
      referral in October through the retention purge in February, and Pro
      adds daily backups. The choice and the cost are the nonprofit's call;
      record it in `decisions.md` either way. **As of 2026-10-16 prod is on
      the free plan**, so the pause risk is live until that changes.
- [ ] **Members:** one person — David for now, Alex once transferred.
      Nobody else is added without a `decisions.md` line. Never an agent.
- [ ] **New project** in that org, named `sub-for-santa-prod`, region
      closest to the admin. Generate a strong database password and store
      it in a password manager — it is needed once below and never again by
      a person.
- [ ] Note the **project ref** (the 20 letters in the project URL) and, from
      Project Settings → API, the **project URL** and the **publishable
      key** (`sb_publishable_…`). Those two are public by design and go into
      `public/config.js` (step 6).
- [ ] Authentication → URL Configuration:
  - **Site URL:** `https://<pages-project>.pages.dev`
  - **Redirect URLs:** `https://<pages-project>.pages.dev/**` and
    `https://<pages-project>.pages.dev` (the bare origin; see dev §2) and nothing
    else. No wildcard, no localhost, no previews — prod is reached from the
    live site only.
- [ ] Authentication → Sign In / Providers:
  - **Email: OFF.**
  - **Google: ON**, with the *prod* OAuth client from step 2.
  - Everything else: off.
- [ ] Personal access token for Actions: Account → Access Tokens → Generate
      → `github-actions-prod`. Different token from dev's.
- [ ] **Never** connect an MCP, the CLI's `link`, or any agent tool to this
      project. `.mcp.json` must never contain this project ref.

### 2. Google Cloud — the prod OAuth client — *Human*

- [ ] A new OAuth client ID, *Web application*, named `Sub for Santa (prod)`.
- [ ] **Authorized JavaScript origin:** `https://<pages-project>.pages.dev`
- [ ] **Authorized redirect URI:**
      `https://<prod-project-ref>.supabase.co/auth/v1/callback`
- [ ] **Publish the consent screen** (OAuth consent screen → Publish app).
      In *Testing* status, sessions expire after 7 days and only listed test
      users can sign in. Published, the admin's session lasts and no list
      is needed. Scopes are email and profile only, so no verification
      review is required.
- [ ] Copy client ID and secret into Supabase → Providers → Google (step 1).

### 3. GitHub — the `production` environment — *Human (repo admin)*

- [ ] Settings → Collaborators → add **`dwelch2344`** (write). Code owners
      must be collaborators for required reviews to count.
- [ ] Settings → Environments → **New environment: `production`**.
  - **Required reviewers: none.** The gate is the pull request into `main`
    (a code owner reviews it, below), not a second click at the deploy. The
    environment had required reviewers from 2026-10-15 to 2026-11-16; they
    were removed because with one person doing both the review and the
    approval, the second click only added delay to urgent fixes.
  - **Deployment branches:** *Selected branches* → `main` only.
- [ ] Environment secrets:

  | Secret | Value |
  |---|---|
  | `SUPABASE_ACCESS_TOKEN` | the `github-actions-prod` token |
  | `SUPABASE_DB_PASSWORD` | the prod project's database password |
  | `CLOUDFLARE_API_TOKEN` | the same Pages-edit token as dev (same account, same Pages project) |
  | `CLOUDFLARE_ACCOUNT_ID` | the same account ID as dev |

- [ ] Environment variables:

  | Variable | Value |
  |---|---|
  | `SUPABASE_PROJECT_REF` | the prod project ref |
  | `CLOUDFLARE_PAGES_PROJECT` | `sub-for-santa` — the same Pages project as dev; `main` is its production branch |
  | `SITE_URL` | `https://<pages-project>.pages.dev` |

### 4. GitHub — branch protection — *Human (repo admin)*

Settings → Branches → Add rule (or Rulesets, same settings). **Exact values:**

**`main`**

- [ ] Require a pull request before merging — **1** approval
- [ ] Require review from Code Owners — **on** (`CODEOWNERS` lists
      `@dwelch2344` and `@Alexleop33`)
- [ ] Dismiss stale approvals when new commits are pushed — on
- [ ] Require status checks to pass — **on**, and *Require branches to be up
      to date* — on. Required checks, by exact name:
  - `test`
  - `check` (the *Require linked issue* workflow's job)
  - `from-dev` (the *Only dev may merge into main* workflow's job)
- [ ] Require conversation resolution — on
- [ ] Allow force pushes — **off**
- [ ] Allow deletions — **off**
- [ ] Do not allow bypassing the above settings — **on** (applies to admins)

**`dev`**

- [ ] Require a pull request before merging — 1 approval (code owners not
      required: the demo site is where review happens, and a reviewer may be
      the author's mentor on a fork PR)
- [ ] Require status checks to pass — on: `test`, `check`
- [ ] Allow force pushes — off; Allow deletions — off

### 5. First deploy and admin bootstrap — *Human*

- [ ] Open a pull request `dev` → `main`. The *Only dev may merge into main*
      check is green; the *test* check is green; a code owner approves;
      merge.
- [ ] Actions → *Deploy prod* runs on its own: tests, then migrations,
      then upload. About two minutes.
- [ ] Open `https://<pages-project>.pages.dev`. Google sign-in only — no
      email form. Nothing else works yet, and that's right.
- [ ] **Confirm prod is empty:** prod project → Table editor → `households`
      → **0 rows**. If there is anything here, stop: a seed reached prod,
      and that's an incident to understand before going further.
- [ ] The admin signs in once on the live site with her Google account.
- [ ] Alex inserts her `profiles` row following
      [break-glass.md](break-glass.md) — the first, expected break-glass —
      and records it in `decisions.md`.
- [ ] The admin reloads `/queue.html`: "Nothing is waiting for review right
      now." The live site is up and empty.

### 6. The two values that live in code — *Human, via a pull request*

`public/config.js` holds the prod project's URL and publishable key, and
`public/_headers` lists the prod API host in `connect-src`. Both are public
by design and both are placeholders until the project exists. Once step 1 is
done, open a PR into `dev` that fills in `TARGETS.prod` and the CSP host;
`PROD_HOSTNAME` is already `sub-for-santa.pages.dev` and changes only if the
Pages project got a different name. Until that PR reaches `main`, the live
site loads but refuses to start — it reports that prod isn't configured
rather than quietly talking to dev.

### Failure paths to prove, once

- [ ] `git push origin main` from a laptop is **rejected** by branch
      protection.
- [ ] A pull request into `main` from any branch but `dev` fails
      *Only dev may merge into main*.
- [ ] A pull request into `main` cannot be merged without a code owner's
      review (branch protection, above). That review is the release gate.

### Things that must stay true

- `supabase config push` is **never** run against prod. It would turn on
  sign-in by email. The workflow doesn't call it, and neither does a person.
- `seed.sql` never runs against prod. The workflow has no `--include-seed`.
  `households` is empty after the first deploy, and only referrals fill it.
- No `.mcp.json` entry, no `supabase link`, no agent, ever, for prod.
- One person is in the prod Supabase organization: David for now, Alex
  once it is transferred (decided 2026-10-16). Never an agent.
- Every manual change to prod data is a dated line in `decisions.md`
  (`break-glass.md`).

---

## Email sign-in — *Human, once per project, then a workflow*

Decided 2026-11-18: people sign in with a 6-digit code sent to their email.
Google stays as a second button until it is switched off. The page offers
whichever the project has on, so these steps can be done in any order
relative to a deploy; nothing breaks in between.

**Why a domain comes first.** Supabase's built-in mailer only delivers to
the project's own team members. Real mail needs a mail service, and every
mail service needs DNS records on a domain you control before it will send
from it. The domain is **`projectconnectionsanta.org`**, registered at
Namecheap (2026-11-18); its DNS is managed there unless the nameservers
are moved.

### 1. Domain and mail service — *Human (David)*

- [x] Domain: `projectconnectionsanta.org`, Namecheap, renews Aug 2028.
- [ ] Resend account: <https://resend.com/signup>. Free tier: 3,000 emails
      a month, 100 a day. Plenty.
- [ ] Resend → Domains → Add domain → `projectconnectionsanta.org` → region
      closest to the admin. Resend shows three DNS records (a DKIM TXT, an
      SPF TXT and an MX, the last two on a `send` subdomain).
      <https://resend.com/domains>
- [ ] Namecheap → Domain List → *Manage* → **Advanced DNS** → add each
      record exactly as Resend shows it. Host is the part before
      `.projectconnectionsanta.org` (Namecheap adds the rest):
      `resend._domainkey`, `send`, `send`. Leave TTL automatic.
      <https://ap.www.namecheap.com/domains/list/>
- [ ] Back in Resend, *Verify*. Namecheap DNS can take a few minutes to
      propagate; if it says pending, wait five and try again.
- [ ] Resend → API Keys → Create → name `supabase-dev`, permission
      *Sending access*, domain `projectconnectionsanta.org`. Copy it once.
      Make a second one named `supabase-prod`. <https://resend.com/api-keys>

### 2. GitHub — one secret per environment — *Human*

- [ ] Settings → Environments → `development` → Environment secrets → add
      `RESEND_API_KEY` = the `supabase-dev` key.
- [ ] Same in `production` with the `supabase-prod` key.
      <https://github.com/dwelch2344/secret-santa-platform/settings/environments>

Everything else the workflow needs (`SUPABASE_ACCESS_TOKEN`,
`SUPABASE_PROJECT_REF`, `SITE_URL`) is already in each environment from the
deploy setup.

### 3. Run the workflow — *Human clicks, the script does the rest*

<https://github.com/dwelch2344/secret-santa-platform/actions/workflows/configure-auth.yml>
→ *Run workflow*:

| Input | Dev | Prod |
|---|---|---|
| target | `development` | `production` |
| sender_email | `signin@projectconnectionsanta.org` | `signin@projectconnectionsanta.org` |
| sender_name | `Sub for Santa` | `Sub for Santa` |
| google | `keep` | `keep` |
| confirm | *(blank)* first, then `apply` | *(blank)* first, then `apply` |

- [ ] Dev, confirm blank: the log lists every field it would change. Read
      it once. Nothing is written.
- [ ] Dev, confirm `apply`. The log ends with "all verified by reading the
      project back".
- [ ] Prod, the same two runs.

What the script sets, and the only things it sets: email sign-in on,
codes instead of confirmation links, the template from
`supabase/templates/magic_link.html`, Resend as the SMTP server, the site
URL, and Google on or off. `scripts/configure-auth.js` is the full list.
It is not `supabase config push`, and that command is still never run.

### 4. Verify — *Human (the admin, ideally)*

- [ ] On the dev site, sign in with a **Gmail** address: the code arrives
      in the inbox (not spam) within a minute, from
      "Sub for Santa <signin@projectconnectionsanta.org>", code in the
      subject line.
- [ ] Same with an **Outlook / Hotmail** address.
- [ ] The admin signs in on the live site with the address her Google
      account uses. She lands in the console: same account, same role.
      (Same email = same account; a different email would be a new, empty
      one.)
- [ ] A sponsor who signed in with Google before signs in with the same
      email and still sees "My families".
- [ ] If anything goes to spam (it did on 2026-11-19, from both projects):
      1. Add a DMARC record at Namecheap: TXT, host `_dmarc`, value
         `v=DMARC1; p=none; rua=mailto:signin@projectconnectionsanta.org`.
         Gmail and Outlook treat a domain without one as less trustworthy.
      2. Make sure the email carries no links (the template has none since
         2026-11-19; re-run the *Configure auth* workflow with `apply` for
         both projects so the hosted copy matches).
      3. Resend → Domains → the domain → check *Click tracking* and *Open
         tracking* are **off**; tracking rewrites links through Resend's
         domain, another mismatch.
      4. On the test accounts, mark the message *Not spam* and add the
         sender to contacts. New domains earn trust by being opened.
      Resend → Emails shows delivery per address if anything is missing.

### 5. Later: turn Google off — *Human*

Once a week of codes has landed cleanly, re-run the workflow for each
project with `google` = `off` and `confirm` = `apply`. The Google button
disappears on the next page load; existing accounts keep working through
email. Then the Google OAuth clients and their consent screens can be left
alone or deleted.

### Things that must stay true

- The sign-in email never carries anything but the code, the one-tap link
  and the site name. No household data, ever.
- `RESEND_API_KEY` lives only in the two GitHub environments and in Resend.
  Rotating it: new key in Resend, update the secret, re-run the workflow
  with `apply`.
- The workflow is the way hosted auth settings change, next to the
  dashboard. `supabase config push` is still never run against a hosted
  project.

---

## The retention purge — *Human, once, after the drive closes*

Sixty days after the drive closes (Feb 12, 2027 for the 2026 drive) the
family contact rows are deleted. Nobody runs SQL for this.

- [ ] In the app, Drive settings → **Close the drive**. The public list
      empties and claims stop. Nothing is deleted yet.
- [ ] GitHub → Actions → **Retention purge** → *Run workflow*. Type `purge`
      in the confirm box; leave *target* as `production`.
- [ ] The run starts on its own once the confirm box matches; there is no
      second approval. The typed `purge` and the function's own refusal of
      an open drive are the two guards.
- [ ] The run links the project with the same token and password the deploy
      uses and calls `purge_retained_contacts(...)` through
      `supabase db query --linked`. The function refuses an open drive and
      logs the number of rows it deleted to the activity log.
- [ ] Record the run as a dated line in the product repo's `decisions.md`.

To rehearse it, run the same workflow with *target* `development` against
the sandbox first.
