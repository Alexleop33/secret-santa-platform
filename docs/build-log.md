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
