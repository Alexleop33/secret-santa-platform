# The database, locally and hosted

`supabase/` holds everything the database is: `migrations/` (the schema and
RLS policies, applied in order), `seed.sql` (three fake households for
development), `tests/` (pgTAP tests proving RLS denies the wrong reader) and
`config.toml` (how the **local** stack is configured).

## Making someone the admin

There's no sign-up flow for this — one `profiles` row, inserted by hand,
makes an account the admin.

Prerequisite: the account has signed in at least once (sign-in creates its
`auth.users` row the first time it does).

**Locally:** `npm run make-admin -- you@example.test`. It runs the SQL below
inside the local Docker container and can't reach anything else.

**On the dev project:** run this in Supabase Studio's SQL editor against the
project. Replace the placeholder, run it, and don't commit the real address
anywhere.

**On prod:** the same statement, but it is a break-glass action — two people
agree first and it gets a dated line in `decisions.md`. The full procedure is
in [docs/break-glass.md](../docs/break-glass.md).

```sql
insert into profiles (id, role)
select id, 'admin'
from auth.users
where email = 'REPLACE_WITH_REAL_EMAIL';
```

## `config.toml` is local-only. Never `supabase config push`.

`config.toml` configures the stack that `supabase start` runs on your
machine: sign-in by emailed code (the email lands in Mailpit), a generous
email rate limit, Google only if you export a client id and secret.

Parts of it are **wrong for a hosted project** (the rate limits, the local
URLs, the Mailpit sender). `supabase config push` would copy the whole file
onto whichever project is linked — so it is never run, by a person or a
workflow, against any hosted project. Schema changes travel as migrations
(`supabase db push`). Hosted auth settings change through the "Configure
auth" workflow (`.github/workflows/configure-auth.yml`), which sets a named
list of fields and reads them back, or by a human in the dashboard. The
sign-in email itself is one file, `templates/magic_link.html`, used by the
local stack directly and pasted into the hosted projects by that workflow.
