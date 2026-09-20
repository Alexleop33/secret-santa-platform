# Sub for Santa — PLATFORM side

You are in the **platform** repo. This is where code gets written.

Requirements do not originate here. They come from Stories in
[secret-santa-product](https://github.com/Alexleop33/secret-santa-product),
which is open in a different VS Code window.

## What this is

A holiday gift-matching drive for a real nonprofit, running **this season**
with real donors. Caseworkers refer households; a coordinator (Alex's mom)
approves them; donors browse anonymized listings and sponsor a household.

Alex's second goal is learning software engineering. **Teaching is part of the
deliverable, not a side effect.**

## Hard rule: spec before code

Every change starts as a short written spec — what changes, why, what could
break, how we'll know it worked. **Wait for approval before writing code.**

## Hard rule: never hand over code Alex can't explain

After each slice, explain it plainly, then ask Alex to say it back. If he
can't, the slice was too big. Split it and redo the explanation.

## Hard rule: one vertical slice at a time, agents in sequence

A slice = **schema + policy + API + UI + a test, for ONE user action.**

Not "the donor side." Not "the referral form." One action.

Parallel agent teams generate more diff than one person can review, which
defeats the entire purpose of the exercise. Sequence, not fan-out.

## Hard rule: no family PII, anywhere

No names, addresses, or phone numbers for referred households — not in the
database, not in URLs, not in query strings, not in logs, not in error
messages, not in a CSV export. Households are a reference code (`#14`) and a
story. **No photos, ever** (see the product repo's decisions.md for why).

Caseworker and donor **emails** are fine — needed for login.

Policy alone won't hold. A caseworker in a hurry will type "Maria, 412 Oak St"
into a notes field unless the form makes that awkward — field design,
placeholders, validation. When you build the referral form, prevention is part
of the slice, not a follow-up.

## Hard rule: this repo is public

Both repos are public **on purpose**. It's a forcing function, not an
oversight: if something would be embarrassing in a public repo, the system
shouldn't hold it.

What that means every single commit:

- **No real data.** Seeds and fixtures are synthetic and obviously fake —
  `#14`, "boy, 7". Never a real household, never a real donor email.
- **No secrets.** No `.env`, no service-role keys, no connection strings, no
  Stripe keys. Anon/publishable keys only, and only if they're genuinely
  public by design.
- **No production dumps**, ever, for any reason, including debugging.
- **Sandbox is separate from prod.** Different Supabase projects, different
  keys. Nothing gets copied down from prod to develop against.

If you're about to commit something and you'd hesitate to have a stranger
read it, stop and say so.

## Hard rule: stop and flag

Anything touching auth, PII, payments, or deletion: stop, say what you're
about to do, wait. Do not be helpful and proceed.

## Security rules, regardless of stack

- **Never** roll our own auth, sessions, or password storage.
- Donors sign in by **emailed magic link**. No donor passwords anywhere.
- **RLS on every table from the first migration.** Default deny, then open
  specific paths. No table ships without a policy *and a test proving denial.*
- Payments, if any, go through a **Stripe link**. We never touch card data.

## The app must never be the single point of failure

If this breaks in December, mom must be able to fall back to a spreadsheet and
still get gifts to families. **Roster CSV export is a safety feature.** Treat
it as load-bearing, not as a report.

## Proposed stack — recommended, not committed

- **Supabase** — Postgres, Auth, Row Level Security. Alex has prior exposure.
- **React + Vite** front end. Alex has built a React PWA before.
- **DigitalOcean** via GitHub Actions.

Assume React familiarity and some Supabase exposure. **Do not assume depth in
SQL, backend architecture, or RLS** — explain those.

## Data model sketch

Everything hangs off `campaigns`. Resist adding an `organizations` table.

| Table | Columns |
|---|---|
| `campaigns` | name, year, the three dates, status |
| `households` | campaign_id, ref_code (`#14`), story text, status |
| `household_members` | household_id, age, gender, notes — **no names** |
| `wish_items` | household_id, label |
| `claims` | household_id, donor_id, status, claimed_at, released_at |
| `users` | email, role (caseworker / coordinator) |
| `activity` | campaign_id, actor, action, target, timestamp |

## Scope for v1

**Ship:** caseworker referral · coordinator approve/reject queue · donor
browse/claim/release/mark-delivered · roster CSV export · audit log ·
exception queue.

**Defer:** photo upload, co-sponsorship/splitting, thank-you note relay, SMS,
in-app messaging.

**Phase one is caseworker referral + coordinator approval only.** Donor
claiming doesn't open until after Nov 6, so it can land two weeks later.

## Deadlines

| Date | Event |
|---|---|
| **Nov 6, 2026** | Nominations close — caseworker + coordinator flows live |
| **Nov 30, 2026** | Donor claims close |
| **Dec 14, 2026** | Gifts due |
| **Feb 12, 2027** | Retention purge |

## The design reference

The prototype is a single 1,207-line HTML file built by Alex's mom:
`https://claude.ai/code/artifact/2a8412ec-789a-4233-833d-f666df71903d`

**It is the design reference, not the codebase.** Don't port it. Read it for
what the screens should feel like, then build the real thing.

One thing it demonstrates that **cannot be built**: claim a household, unlock
their name and phone. No PII means delivery handoff moves offline — donors buy
against the household code and drop gifts at a central location. The app will
never tell anyone where to drive.

## Working with Alex

- Plain language and diagrams over jargon.
- **Name the tradeoff.** Two reasonable approaches → both, recommend one, why.
- Push back. Agreement is worth less than accuracy.

## Every PR needs a linked issue

CI fails without a closing keyword. Use the full cross-repo form when closing
a product Story:

```
Closes Alexleop33/secret-santa-product#12
```
