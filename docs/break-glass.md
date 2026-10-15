# Break-glass: touching the live database by hand

The live database is changed by exactly one path: a migration in this
repo, merged into `dev`, then into `main`, then approved for deploy. Nobody
runs SQL against it. No agent can reach it — there is no MCP entry for it and
there never will be. **Breaking the glass means stepping outside that path,
on purpose, with a record.**

## When it is allowed

Only when **all three** are true:

1. **Families or the admin are affected right now**, or will be before the
   normal path can land a fix. "It would be quicker" is not this.
2. **The normal path cannot do it.** A migration can add, change or fix
   schema and data; if the fix can be written as a migration and shipped
   through `dev` → `main` in time, do that instead.
3. **Two people agree** — Alex and David (`@dwelch2344`), or either one and
   the admin — in writing (a message is fine). Nobody breaks the glass alone.

Things that are *always* break-glass, even when planned:

- **Inserting the admin's `profiles` row on prod.** There is no sign-up flow
  for admins, by design, so the first admin is always inserted by hand.
  This is the first and expected use.
- Deleting or correcting a specific household's row because of a real-world
  mistake (a duplicate referral, a family that withdrew).
- Anything run in the Supabase SQL editor or Table editor against prod.

Things that are **never** allowed, glass or no glass:

- Copying production data anywhere — a dump, a CSV, a screenshot of rows,
  a paste into a chat. Debugging happens on dev with fake data.
- Connecting any agent, MCP, or automated tool to prod.
- Running `supabase config push`, `seed.sql`, or `db reset` against prod.
- Changing auth settings on prod without a `docs/environments.md` entry.

## Who

The prod Supabase project lives in its own organization, and **Alex is its
only member.** So in practice Alex runs the statement, with the second
person's agreement in hand. If Alex is unreachable in an emergency, the admin
has owner access to the organization's billing account and can add a member
— that, too, gets a line in `decisions.md`.

## How

1. Write the exact SQL first, in a message to the second person. One
   statement if at all possible. `select` before `update` or `delete` to
   see what will change, and how many rows.
2. Get the "yes".
3. Supabase dashboard → the **prod** project (check the name twice — the dev
   project is one click away) → SQL editor → paste → run.
4. Verify the effect with a `select`, and in the app if it's visible there.
5. **Record it, the same day,** as a dated entry in the product repo's
   `docs/decisions.md`:

   ```markdown
   ### YYYY-MM-DD · Break-glass: <one line on what and why>

   **Who:** <name>, agreed by <name>.
   **What ran:** <the statement, or a description if it would reveal PII — it
   never contains a family's name or address anyway, because the database
   never holds one>.
   **Why the normal path couldn't:** <one or two sentences>.
   **Follow-up:** <the migration or fix that makes this unnecessary next time,
   or "none needed">.
   ```

6. If the same thing is needed twice, it isn't an emergency any more. Write
   the migration, or the feature.

## The first use: the admin's row

After the first prod deploy, the admin signs in once with Google on the live
site. That creates her `auth.users` row and nothing else — she can see no
households, because she isn't the admin yet. Then Alex runs, in the prod SQL
editor:

```sql
insert into profiles (id, role)
select id, 'admin'
from auth.users
where email = 'REPLACE_WITH_THE_ADMIN_EMAIL';
```

and records it in `decisions.md` as above. From then on she sees the queue.

*Rejected alternative:* a "first person to sign in becomes admin" function.
Sign-up is open — it has to be, for Google sign-in to work — so that would be
a race between the admin and whoever else finds the URL first.
