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
- **Payments go through a Stripe link.** We never touch card data.
- **The app must never be the single point of failure.** If it breaks in
  December, the coordinator falls back to a spreadsheet and gifts still get
  delivered. Roster CSV export is a safety feature, not a report.

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

Not yet committed — a starting recommendation.

| Layer | Choice | Why |
|---|---|---|
| DB / auth | Supabase (Postgres + RLS) | Alex has prior exposure; RLS is the security model |
| Front end | React + Vite | Alex has built a React PWA before |
| Deploy | DigitalOcean via GitHub Actions | stated intent |

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
| **Oct 15, 2026** | First running version published |
| **Nov 6, 2026** | Nominations close — caseworker + coordinator flows live |
| **Nov 30, 2026** | Donor claims close |
| **Dec 14, 2026** | Gifts due |

Phase one is caseworker referral + coordinator approval. Donor claiming lands
after Nov 6.
