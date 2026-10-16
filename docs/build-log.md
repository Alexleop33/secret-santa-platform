# Build log

A running record of the autonomous build that started on 2026-10-15, written
for Alex to catch up from. One entry per slice: what changed, why, and the
one idea to be able to say back. Newest at the bottom.

Everything in this log happened on the fork `dwelch2344/secret-santa-platform`.
The section at the end lists what would move to Alex's repos if we rebalance.

## How to read a slice

Each slice is one pull request into `dev` with a linked issue on the fork.
The PR body follows `.github/pull_request_template.md` and ends with a
"For Alex — say it back" section. If you can say that section back in your
own words, you understand the slice.

## Slices

### 1. Handbook committed and linked — issue #7

- `docs/handbook/` is now in the repo: journey map, personas, 21 annotated
  mockups. CLAUDE.md points at it and lists what in it the hard rules
  overrule.
- **Say it back:** the handbook is what the app should look and feel like;
  the hard rules in CLAUDE.md decide what it may *do*. When they disagree,
  the rules win, and the list in CLAUDE.md says where.

### 2. Design system — issue #8

- One stylesheet, `public/styles.css`: tokens from the handbook (cream,
  deep green, cranberry, amber), two self-hosted variable fonts, the donor
  header shell and the coordinator sidebar shell, and the components every
  later page uses (cards, buttons, pills, tags, notices, fields, folding
  sections, tables, tiles).
- `tests/pages.test.js` reads every page and script and fails if one
  carries an inline style or loads from a host the CSP does not allow.
- **Say it back:** pages never write CSS of their own; they put classes on
  elements and the stylesheet decides the look. That is what lets the
  Content-Security-Policy say "styles only from this site" and mean it.

### 3. Campaign settings — issue #9

- New `campaigns` table with one 2026 row, created by the migration with
  bracketed placeholders; `households.campaign_id` points at it. The seed
  fills in obviously fake contact details for the sandbox.
- `public_campaign` is a **view** that lists only the public columns, so
  anyone can read dates and the contact line but the drop-off address never
  leaves the table. Only the admin reads or updates the table itself.
- `is_admin()` is the one helper every later policy will call.
- `settings.html` is the A5 top half: season, dates, rules. The dates-in-
  order rule is a database check constraint, so a bad save is refused by
  Postgres and the page just shows the message.
- `console.js` holds the sidebar list and the "sign in first" card for
  every coordinator page.
- **Say it back:** RLS hides *rows*; a view hides *columns*. The address
  is a column, so it needed a view, not a policy.

### 4. Referral links — issue #10

- `referral_links` stores a SHA-256 hash of each token, its expiry (seven
  days from creation) and, once used, which household it became. No plain
  token column exists.
- `create_referral_link()` is a `security definer` function: it checks
  `is_admin()` itself, makes 24 random bytes, stores the hash, and returns
  the plain token exactly once. There is no INSERT policy on the table, so
  the function is the only way in.
- `links.html` builds `…/refer.html#t=TOKEN`. The token sits in the URL
  fragment, which browsers never send to a server, so it stays out of logs.
- **Say it back:** the database keeps a fingerprint of the link, not the
  link. A fingerprint can confirm a link is genuine but cannot be turned
  back into one, so a leaked database is not a pile of working links.

### 5. The family referral form — issue #11

- Three new tables: `household_members` (a role from a fixed list and an
  age, never a name), `wish_items` (one row per item, split out of the
  comma lists so a sponsor can tick them later), `household_contacts` (the
  family's email, alone in its own table). None has an INSERT policy.
- `submit_referral(token, json)` is the only way in: one transaction that
  locks the link row, checks it, checks every free-text field for a phone
  number, email or street address, writes everything, and burns the link.
  Two submissions racing on one link queue up on the lock and the second
  finds it used.
- `refer.html` is C1 rewritten for the family. The same three patterns
  warn while typing; a school name warns but does not block, because that
  is a judgement for the coordinator.
- **Say it back:** the form never writes to a table. It hands the database
  one JSON document and one token, and a single function decides whether
  all of it lands or none of it does. "Burn the link" and "save the
  household" cannot come apart.

## Rebalancing into Alex's repos later

Stories normally live in `Alexleop33/secret-santa-product` and PRs close
them cross-repo. During this run everything was filed on the fork so the
`Require linked issue` check had something to close without write access to
Alex's repos.

| Fork issue | Would become |
|---|---|
| #7, #8, #27 | product Story "The app looks like the handbook" |
| #9–#18, #28 | product Stories under an Epic "Referral chain and console" ( #10 mirrors product #6 ) |
| #19–#24, #29 | product Stories under an Epic "Donor side" |
| #25, #26, #30 | product Stories under an Epic "Close-out" |

To move one: open the Story upstream with the same body, then edit the fork
PR description's `Closes #N` to `Closes Alexleop33/secret-santa-product#N`.
Nothing in the code references issue numbers.
