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

**On a hosted project:** run this in Supabase Studio's SQL editor against the
project. Replace the placeholder, run it, and don't commit the real address
anywhere.

```sql
insert into profiles (id, role)
select id, 'admin'
from auth.users
where email = 'REPLACE_WITH_REAL_EMAIL';
```

## `config.toml` is local-only. Never `supabase config push`.

`config.toml` configures the stack that `supabase start` runs on your
machine. It turns on sign-in by emailed link (the link lands in Mailpit) and
raises the email rate limit, because a fresh clone has no Google OAuth client
to sign in with.

Those settings are **wrong for a hosted project**. Both hosted projects keep
the email provider off and use Google only. `supabase config push` would copy
this file's auth settings onto whichever project is linked — so it is never
run, by a person or a workflow, against any hosted project. Schema changes
travel as migrations (`supabase db push`); auth settings are changed by a
human in the dashboard, following the per-environment checklist.
