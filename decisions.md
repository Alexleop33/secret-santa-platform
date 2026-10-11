# decisions.md — what the code decided before it was deleted

Written for Alex, reviewing later.

## What this file is

The platform repo had two folders of working code in it: `data-model/` (a
SQLite schema, seed data and two shell scripts) and `prototype/` (a 21-screen
clickable draft). Neither was ever committed, so neither is recoverable from
git history once removed.

Those files carried a lot of reasoning in their comments — most of it decisions
with a *why* attached, some of it questions nobody has answered yet. This file
is that reasoning, lifted out before the files went, so the thinking survives
the code.

**This is a capture document, not the decisions log.** The real append-only log
lives in the product repo (`secret-santa-product/decisions.md`). Anything here
that deserves to be permanent should be promoted there, in that log's format,
with a date. Treat this as a review queue.

Three kinds of entry below:

- **Settled** — decided, with the reasoning and the rejected alternative.
- **Open** — flagged in the code as needing a call, and still needing one.
- **Conflicts** — two places that disagreed with each other.

---

## Part 1 — Settled decisions

### The stack

> **Partly superseded on 2026-10-11.** Items 2, 4 and 6 below no longer hold:
> Postgres with row-level security replaced SQLite, the portable-SQL rule was
> dropped with it, and RLS replaced the one-data-module rule as the security
> boundary. Item 3 (zero npm) was relaxed the same day — packages are allowed
> where they genuinely help. The text is
> kept unchanged because this is a capture document — the current position
> lives in the product repo's `decisions.md`.

1. **Plain HTML, CSS and JavaScript.** No React, no Vite, no TypeScript, no
   bundler, no build step. The reason is the teaching goal, not performance:
   you have to be able to read every line. This is already in `CLAUDE.md`.

2. **SQLite, one file, built from `.sql` files.** The `.sql` files are the
   source of truth; the database file is disposable and rebuilt from scratch
   every time. Superseded Supabase on 2026-09-23. The practical win is that the
   app runs locally with no service to sign into.

3. **Zero npm dependencies.** `node:http`, `node:sqlite` and `node:test` are
   all built into Node, so nothing needs installing. A browser cannot open a
   SQLite file, which is why a small server is a requirement rather than a
   preference.

4. **Portable SQL only** — no SQLite-only syntax, dates as ISO strings. Keeps
   the eventual move to Postgres cheap. This rule had real teeth and shows up
   several times below.

5. **Deployment is still undecided.** Local only.

6. **No row-level security, because SQLite has none.** The replacement rule:
   every read and write goes through **one** server-side data module that takes
   the acting user and scopes the query to them. No table ships without a test
   proving the wrong user gets nothing back. Same guarantee as RLS, one layer
   up, and now our job rather than the database's.

   The schema was built to support that rule — these are the columns that do
   the scoping:

   | Who is asking | What they should see | Column that scopes it |
   |---|---|---|
   | provider | only their own referrals | `households.referred_by` |
   | donor | the public list, plus their own claims | `households.status = 'live'`, `claims.donor_id` |
   | admin | everything | nothing to scope |
   | a switched-off account | nothing at all | `users.status = 'disabled'` |

   `'disabled'` is not a display state. It is the **first** thing the data
   module checks, before working out what the user is allowed to see.

### The role rename, 9 Oct 2026

7. **`caseworker` → `provider`, `coordinator` → `admin`.** This followed a
   change in the job, not a change of mind about wording. A caseworker used to
   type a family's details into the system. A provider never does — they create
   a one-time link, email it, and the family fills in the form themselves.
   "Provider" also covers the therapists and social workers who refer, where
   "caseworker" named one job title among several.

   Two consequences worth remembering:

   - These three strings are load-bearing. `users.role` enforced them with a
     `CHECK` constraint, so the words appear in the schema, the API and every
     test. If you find `caseworker` anywhere, it is a leftover.
   - The product repo's log is append-only, so entries written before that date
     still say caseworker and coordinator. They stay as history.

### Tooling and repo hygiene

8. **`*.db` is gitignored.** The database is built, never committed.

9. **Editor recommendations stripped to match the stack.** ESLint, Prettier,
   Tailwind, Supabase and Playwright extensions removed; `sqlite-viewer` added.
   Nothing recommended is a linter or a bundler, because there isn't one.

10. **Agent permissions swapped** from npm/Supabase commands to `node --test`,
    the two data-model scripts, and `sqlite3`.

11. **The PR template's checklist changed shape.** "Migration applied" and "RLS
    policy written and a test proving denial" became: `data-model/*.sql` updated
    and `build.sh` runs clean · `check-no-pii.sh` passes · every new read/write
    goes through the data module scoped to the acting user, with a test proving
    the wrong user gets nothing back.

### The data model: nine tables where the sketch lists seven

`CLAUDE.md` sketches seven tables. The schema had nine. Six deliberate
divergences:

12. **One `users` table, not a table per role.** Donors have to be in `users`
    anyway because `claims.donor_id` points at it, so one table covers all
    three roles and signing in works the same way for everybody. The prototype
    had kept a separate `providers` table; the schema folded it in.

13. **`claims` points at a donor, it does not copy them.** The prototype stored
    `sponsor_name` and `sponsor_email` on every claim row. With `donor_id`, a
    donor's email lives in exactly one place.

14. **No `sponsor_phone`.** `CLAUDE.md` permits donor *emails*, for login. It
    says nothing about phone numbers, and a column that exists gets filled in.

15. **`received`, not `delivered`.** It means arrived at the drop-off point.
    The app never learns whether gifts reached a family — that last step is
    offline, because the app holds no address to send anyone to.

16. **`users` carries five staff-only columns the sketch doesn't list:**
    `display_name`, `status`, `invited_at`, `invite_expires_at`, `disabled_at`.
    The admin's staff page cannot exist without them. All five are `NULL` on a
    donor row.

17. **Two tables the sketch doesn't have at all:** `household_contacts` and
    `form_links`. Both explained below.

The sketch in `CLAUDE.md` was left as-is rather than re-synced on every column
— divergences were recorded next to the schema instead. **That is now a
problem**, since the schema is gone and the sketch is the only thing left; see
Part 3.

### Privacy, as enforced by the schema

18. **`households` has no name, address or phone column** — not as a promise
    not to use them, but because they do not exist. A column that is not there
    cannot leak into a URL, a log line, an error message or a CSV export.

19. **`household_members.label` is a description, never a name** — `'Boy, 11'`,
    `'Mom'`, `'Grandmother'`. This was identified as the single most likely
    place for a real name to get typed by accident, and the conclusion was
    explicit: **schema alone will not stop it.** The referral form has to make
    it awkward, with field design, placeholders and hints. That is part of the
    form's slice, not a follow-up.

20. **The story consent gate is a database constraint**, not app logic:
    `CHECK (story_published = 0 OR story_consent = 1)`. A family that wrote a
    story but didn't tick the box can never have it published — the database
    refuses the row. Donors see the summary and the wish list, never the
    paragraph.

21. **`household_contacts` is its own table, not a column on `households`.**
    This is the single exception to "no family contact data", and it exists
    because the family fills in the form themselves and the form emails them a
    copy of what they typed. Three reasons it's a separate table, and they all
    matter:

    1. The February purge is one statement — `DELETE FROM household_contacts` —
       and it cannot damage a story, a wish list or the audit log, because it
       cannot reach them.
    2. Every donor-facing query selects from `households`. A column there is one
       careless `SELECT *` away from a donor's browser. In a separate table,
       reaching it takes a deliberate `JOIN` nobody writes by accident.
    3. An absent row is unambiguous. No row means no email — different from an
       empty string that might be a bug.

    The primary key is the household id itself, so "at most one email per
    family" is a rule the database enforces rather than something we remember.
    No name, no phone, no address, no second contact: email only, because only
    the email has a job.

22. **`activity.target` holds a ref code (`'#04'`), not a household id**, so the
    log still reads sensibly after the retention purge deletes the household row
    it points at. The log survives; the family's details do not.

23. **`check-no-pii.sh` greps the `.sql` files before committing** for three
    shapes: street addresses (`412 Oak St`), phone numbers, and any email not on
    `@example.com` / `@example.org` — the two domains the IETF reserves, which
    can never belong to a real person. It was deliberately not clever: it catches
    the careless mistake, not a determined one. (It found emails the long way
    round — match all, subtract allowed — because BSD grep can't express "an
    email that is NOT example.com" in one pattern.)

24. **The admin's real name never went in the seed.** Her row read
    `'[Admin name]'`, as a placeholder, because the repo is public and she is a
    real person.

25. **No PII-bait row in the seed.** The prototype's referral `#30` mentions a
    school name on purpose, as something for the publishing check to catch. That
    row belongs in the referral form's test fixtures, next to the validation it
    tests — not in a public repo's seed, where it would also fail
    `check-no-pii.sh` on every run.

### Deleting people, and why there are two different actions

26. **`PRAGMA foreign_keys = ON` is load-bearing, not decoration.** SQLite
    ignores foreign keys unless you ask it not to, and forgets every time you
    reconnect. With it on, the database refuses to delete a provider who has
    referrals. With it off — SQLite's default — the same `DELETE` silently
    succeeds and orphans them.

27. **`DELETE` and disable are two independent actions, and the foreign key
    decides which one you get.**

    - `DELETE` is a real delete. The row goes. It works whenever nothing points
      at it — a typo'd invite, someone who never accepted — which is most of the
      time anyone wants an account gone.
    - `disabled` is the sign-in switch, for a provider who has already done
      work. `households.referred_by` and `form_links.created_by` both point at
      their row, so SQLite refuses to delete it. Setting status to `'disabled'`
      stops them signing in while their name stays on the referrals they made.
      `disabled_at` records when — a question December will ask.

    Note which way round that is: `'disabled'` is not a cage. A disabled account
    with nothing pointing at it still deletes. **Nothing is called `'deleted'`,
    because a row that still exists is not deleted.**

28. **Disabled accounts still come back from the staff query**, on purpose — the
    admin needs to see that an account *was* switched off, not just find it
    missing. Whether the page greys them out or hides them behind a filter is a
    screen decision, not a schema one.

### Invites and links

29. **`invited_at` is not `created_at`.** The staff page has a "Resend invite"
    button; resending moves `invited_at` and `invite_expires_at` while
    `created_at` stays put. Without the split you cannot tell "invited once,
    three weeks ago" from "we have chased them four times".

30. **`invite_expires_at` is stored, not computed.** Computing it needs
    `datetime(invited_at, '+24 hours')` — SQLite-only syntax Postgres spells
    differently, and we only write portable SQL. Storing it also means that if
    the window ever becomes 48 hours, invites already sent keep the deadline
    they were actually sent with.

31. **There is no `'expired'` status, anywhere.** An expired invite is status
    `'invited'` with `invite_expires_at` in the past. A stored `'expired'` would
    need something to go and change rows when a clock passes a time, and nothing
    in this app wakes up to do that. Same trick on `form_links`: a link's state
    is readable from its two timestamps (unused and valid · unused and expired ·
    spent).

32. **`form_links` is a table, because "a one-time link" has to remember three
    things**, and that was a fair thing to question:

    1. **Whether it has been used.** "One-time" is only true if something knows
       the link is spent. With nothing stored, the link works forever.
    2. **When it expires.** Stored not computed, for the portability reason
       above.
    3. **Which provider sent it.** This is the real one. The family is *not*
       signed in — they have no account and never get one — so when the form is
       submitted there is nobody to attribute it to. `created_by` is where
       `households.referred_by` comes from.

    So the link is a name tag, not just a door: it carries the provider's
    identity to a form filled in by someone the system has never seen.

    **Rejected alternative:** a signed stateless token holding the provider id
    and an expiry, verified on arrival, storing nothing. It handles 2 and 3 but
    cannot do 1 — there is nothing to mark as spent — and it means writing our
    own token signing, which runs into *never roll our own auth*. Rejected on
    both counts.

33. **`used_at` and `household_id` are two halves of one fact**, held together
    by a `CHECK`: either both set or neither. The link was spent, and here is
    what came out. Kept in the database rather than in app code that might set
    one and forget the other.

34. **One link, one household by convention rather than by constraint.**
    `UNIQUE(household_id)` would be wrong the moment there are two unused links,
    since both have `NULL`. The data module enforces "do not spend a link twice"
    by refusing when `used_at` is already set.

35. **Switching a provider off does not touch their links.** The account goes to
    `'disabled'` and stops working, past referrals keep their name, and any link
    they already sent simply expires unused.

### Shape of the data

36. **No `organizations` table above `campaigns`.** One nonprofit, one drive per
    year. Adding a layer we don't need would mean every query carries a join
    that always matches.

37. **Dates are `TEXT`.** SQLite has no date type. Stored as `'YYYY-MM-DD'` they
    sort correctly as plain text — which is the only reason this works. Any
    other format and ordering silently breaks.

38. **No boolean type either**, so `0` or `1` in an `INTEGER` with a `CHECK`.

39. **`id` and `ref_code` are deliberately different numbers.** `id` is the
    database's internal handle, never shown to anyone. `ref_code` is what a
    human says out loud — "who's got #04?". Keeping them separate means the
    admin can renumber ref codes, or start next year at #01 again, without
    anything breaking underneath. `UNIQUE (campaign_id, ref_code)`.

40. **`wish_items` is its own table, one row per single item.** It could have
    been two text columns on `household_members` — `needs` and `would_love` —
    which would be six tables and no join. The reason it isn't: **an item that
    gets ticked off has to keep its identity.** Stored as a list inside a column,
    comma-separated or JSON, an item is identified by its position in that list.
    Delete an earlier item, or let a provider reorder them, and position 1 now
    points at something else — so a "received" flag silently moves to a
    different thing. As a row, the winter coat is `id 1` for good.

    The rule that keeps this honest: **one row holds one item.** `'Winter coat'`
    and `'Jeans'` are two rows, never one row reading `'Winter coat, jeans'`.
    Break it and item counts quietly start under-reporting while still looking
    fine, and ticking one thing off starts meaning two.

41. **Storage shape and screen shape are separate problems.** Items appear
    nested under each family member on screen; that's a `GROUP BY`, not a table
    shape. Rows don't have to be stored nested to be displayed nested.

42. **`needs` vs `would_love`** — separating the two lets a donor cover the
    needs first on a tight budget.

43. **`wish_items.household_id` is deliberately redundant** (you could find it
    through `member_id`). It's there because "every wish item for household #04"
    is the most common question the app asks, and this makes it one lookup
    instead of two. A conscious trade: a little duplication for a much simpler
    query.

44. **`claims` has three timestamps, not one `updated_at`.** `claimed_at`,
    `received_at`, `released_at`. In December the admin has to answer "when did
    that happen?", and a single column that keeps getting overwritten has
    already thrown that answer away. Read the `NULL`s across a row and you can
    see how far along it is.

45. **One step for the handover, not two.** An earlier draft had a separate
    `dropped_off` state for the donor reporting they'd left a bag, which the
    admin then confirmed. The donor records nothing: they hand the bag over in
    person and the admin writes it down. Dropping off and receiving are the same
    moment seen from two sides, so they are one column, set once, by the admin.

46. **A released claim keeps its row** rather than being deleted, so the history
    of "#09 was claimed once and given up" survives, and a household can collect
    more than one claim over a season. That's also why `claims` is its own table
    and not a few columns on `households`.

47. **Two `received_at` columns, and they are not duplicates.**
    `claims.received_at` means the bag turned up at the org;
    `wish_items.received_at` means this particular thing was inside it. A short
    box is the first set while some of the second are still `NULL` — which makes
    **the exception queue a query, not a feature.**

48. **Checking a box in is normally one statement on the whole household**
    (`UPDATE wish_items SET received_at = ? WHERE household_id = 1`). Per-item
    only costs anything on the rare short box, where whatever didn't turn up is
    left `NULL`. One shape, both behaviours.

49. **`NULL` means "has not happened yet"** — not zero, not an empty string.
    (On donor rows in `users` it also means "does not apply", which the file
    called out as a second meaning worth knowing.)

50. **`activity` is append-only.** Nothing in it is ever updated or deleted.
    `action` and `target` are separate columns rather than one readable
    sentence, so they can be filtered and counted. `actor_id` is `NULL` for
    anything automatic.

51. **The log is not a guarantee that every event is in it.** The seed had four
    households appearing nowhere in the log — two approved before the log
    started, two not yet approved. Worth knowing before building anything that
    assumes completeness.

52. **Date arithmetic stays out of the SQL.** The staff page's "18 hours left"
    is computed in the page from an ISO string, because hours-between is the one
    piece of date maths SQLite and Postgres spell completely differently.
    Keeping it out of the query is what keeps the query portable.

53. **Not a migration.** The whole schema was rebuilt from scratch every time,
    not a stack of changes applied in order.

54. **No indexes, views or triggers** — nothing that hides behaviour from a
    first read.

### How the seed data was built

55. **Small on purpose** — 8 households, not 80, so you can read the whole thing
    and hold it in your head. Between them they covered every household status,
    every claim status and every staff account status, including the awkward
    ones: a claim that was given up, a box that arrived short, and an account
    that was switched off.

56. **Pinned to a fake "today" of 26 Nov 2026, 15:00Z** — the same fake date the
    prototype used, so both sample sets told the same story. Three weeks before
    gifts are due, which is when the drive is busiest and the most interesting
    states all exist at once.

57. **Two deliberate rough edges**, because real data has them: `#19` had an
    empty story (empty string, not `NULL` — "withdrawn before anyone wrote one"
    is a real state) and a member but no wish items. A screen that assumes every
    household has items will break on the first one. Also worth knowing: `#07`'s
    story was third person and `#30`'s first person. Both happen in real
    referrals.

58. **`pronouns` is free text, not a `CHECK` list of two options** —
    `'they/them'` was in the seed as one of the values the column holds, not a
    special case to handle.

59. **Adults are in `household_members` with no age.** A donor shopping for a
    household often wants to put something in for the parent, and a grocery card
    usually matters more than a gift. Ages are on the kids because sizes and
    toys depend on them; an adult's age changes nothing about what to buy.

### The prototype

60. **It was a design draft, not the app, and explicitly not to be ported.** 21
    screens, four lanes, built from the *Sub for Santa — User Journey Flows*
    canvas as it stood on 9 Oct 2026. Its own README made the point that the
    warning got *harder* to follow once the stack was decided: the draft is
    plain HTML, CSS and JavaScript, which is exactly what the real app is built
    from, so nothing about the markup *looks* wrong when you paste it. The
    original prototype had already been mistaken for a codebase once.

61. **It was shaped for SQL without containing any**, via four rules worth
    keeping when the real thing gets built:

    1. **Every data function was `async`**, even though the answer was already in
       memory — so each body becomes a `fetch` later and no screen changes.
       Synchronous accessors would mean rewriting every call site.
    2. **Sample data held rows, not screen content** — integer ids, foreign
       keys, ISO date strings, lowercase status values.
    3. **Nothing derived was stored.** Every count, percentage and progress bar
       was worked out in the data layer, because in SQL they're `COUNT(*)`.
       That's also why the numbers on different screens always agreed.
    4. **Screens never touched the data directly.** They called the data layer
       and nothing else — the same separation the real data module needs.

62. **Three departures from the canvas, each marked on the screen itself:**

    - **No family contact card.** The canvas unlocks a household contact name
      and phone number once a donor claims. That cannot exist under no-family-
      PII, so those screens route questions through the admin instead. The admin
      holds the code-to-family mapping in her own records; **the app never tells
      anyone where to drive.**
    - **Provider sign-in is an emailed link.** The canvas draws a username and
      password. Storing passwords is ruled out by *never roll our own auth*.
    - **The household's email is the one piece of family contact data** — the
      confirmation screen cannot work without it.

63. **The design language was lifted from the canvas, not invented:** Manrope
    over IBM Plex Sans, warm cream ground, cranberry for the donor's next step,
    deep green for the admin console, amber for anything unresolved. Light theme
    only, because the reference has no dark one.

64. **Deliberate non-features:** no photos (not in the draft, not later), no
    payments (drop-off only), no persistence, no validation, no real claim race.
    Buttons that would need a back end said so when clicked.

---

## Part 2 — Open questions, flagged and still unanswered

These were written down as *not decided*. They need calls, most of them at a
specific point in the build.

### Decide before this holds real data

1. **`form_links.token` was stored in the clear.** A real build should store a
   **hash**, the same way a password-reset token is hashed, so that a copy of
   the database doesn't hand someone a set of working links. It was in the clear
   only because the file was a readable model with invented tokens in it.
   **Decide before this holds real referrals.**

2. **`household_contacts` is marked REVISION NEEDED** in the product repo's
   `decisions.md`, dated 2026-10-10. Current behaviour: the row is deleted when
   a referral is rejected, kept when it is approved. The open part is whether
   anybody actually needs the confirmation copy — if not, **the table should not
   exist.** Needs revising before the drive goes public.

3. **The two link lifetimes were never properly decided.** 24 hours for a staff
   invite, 48 hours for a family form link, both inherited from the journey
   canvas.

### Decide when the matching slice gets built

4. **Who switched an account off.** `users.disabled_at` records *when*, and
   nothing records *who*. `activity` is the obvious home, but its `target`
   column is documented as holding a ref code and never a name, and an account
   action has neither. Needs a decision **when the audit-log slice lands** — it
   was flagged rather than guessed at.

5. **The two `received_at` columns can drift apart** if code sets one without
   the other. **Needs a test when the donor slice gets built.**

6. **The claim race needs one atomic claim on the server.** The prototype drew
   what losing the race looks like; making it true is a real piece of work.

7. **The referral form's PII validation isn't written.** Placeholders, hints and
   field design are the plan; the rules that enforce it are not written yet. The
   automatic check in the draft was a single keyword match for a school name.

8. **Donor re-entry.** Donors have no account, so a donor's "my families" page
   needs a way back in — presumably a link in the confirmation email.

9. **The per-sponsor cap isn't checked on confirm.**

10. **No donor self-cancel.** A sponsor who can't finish emails the admin. And
    re-listing a family after a sponsor backs out has no control yet.

11. **Whether the family hears again when a sponsor claims them was never
    discussed.**

12. **The provider sign-in mechanism is still open** — drawn as an emailed link,
    not specified.

13. **The approval queue's edit screen was never drawn.**

14. **A co-sponsor's ticks aren't told apart from the sponsor's.**

15. **The roster export included referrals awaiting review**; the canvas left
    them out. Which is right is a decision.

---

## Part 3 — Conflicts to resolve

Places where two things disagreed. Worth settling before code gets written
against either.

1. **Claim status vocabulary.** The prototype used `sponsored` →
   `dropped_off` → `delivered`. The schema used `sponsored` / `received` /
   `released`, having explicitly collapsed the two-step handover into one and
   renamed `delivered` to `received`. **The schema was the newer decision.**

2. **`CLAUDE.md` and `README.md` were reverted to `eeebed3` and now contradict
   this whole file.** They are back to describing Supabase, Postgres, React,
   Vite, DigitalOcean, RLS on every table, `caseworker` and `coordinator`, and a
   seven-table sketch with `users` as `email, role`.

   **Every decision in Part 1 now lives only here.** Nothing in the repo records
   that Supabase was superseded, that the stack is plain HTML/CSS/JS on SQLite
   with zero npm dependencies, that RLS was replaced by the one-data-module
   rule, or that the roles were renamed on 9 Oct 2026. A reader of `CLAUDE.md`
   today would be told to build the wrong thing.

   That is a deliberate reset, not an oversight — but it means promoting Part 1
   into the product repo's `decisions.md`, and then back into `CLAUDE.md`, is
   the first piece of work, not a tidy-up.

3. **The canvas is newer than the v1 scope list.** Co-sponsorship and the
   thank-you relay are both drawn as screens and both on the defer list. They
   need reconciling.

4. **Tables the prototype implied that the schema didn't adopt:** `providers`
   (folded into `users`), `co_sponsors` and `thank_yous` (deferred), and drive
   settings on `campaigns` — a nominations-open date, a per-sponsor cap, and a
   "show the remaining count publicly" toggle. The settings screen existed but
   was wired to nothing.

---

## Part 4 — What was removed, and what wasn't

Removed (never committed, so not recoverable from git):

```
data-model/schema.sql        531 lines — nine tables, heavily commented
data-model/seed.sql          ~92 rows of synthetic example data
data-model/build.sh          rebuilt santa.db from the two .sql files
data-model/check-no-pii.sh   the address/phone/email grep
data-model/santa.db          the built database
data-model/README.md         283 lines of explanation
prototype/app.js             1,748 lines — sample data, data layer, 21 screens
prototype/index.html         page shell and draft toolbar
prototype/styles.css         544 lines — design tokens from the canvas
prototype/README.md          the "this is a draft, not the app" document
```

Also reverted — six uncommitted changes to the governing docs and config,
returned to commit `eeebed3`:

```
CLAUDE.md                            lost: stack decided, RLS rule replaced, roles renamed
README.md                            lost: the three-roles table, the rename, the stack table
.gitignore                           lost: *.db
.vscode/extensions.json              back to eslint/prettier/tailwind/supabase/playwright
.claude/settings.json                back to npm/supabase permissions
.github/pull_request_template.md     back to "Migration applied" + "RLS policy written"
```

**Decisions 1–11 in Part 1 were only ever written in those two files.** They are
not committed anywhere, so this document is now the sole record of them. See
Part 3, item 2.

The repo is therefore back to its state at `eeebed3` — an empty scaffold whose
documentation describes Supabase, React and RLS — plus this file. Working tree:

```
?? decisions.md
```
