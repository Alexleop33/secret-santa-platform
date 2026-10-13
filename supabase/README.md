# Making someone the admin

There's no sign-up flow for this — one `profiles` row, inserted by hand,
makes an account the admin.

Prerequisite: the account has signed in at least once (Google sign-in
creates its `auth.users` row the first time it does).

Run this in Supabase Studio's SQL editor against the project. Replace the
placeholder, run it, and don't commit the real address anywhere.

```sql
insert into profiles (id, role)
select id, 'admin'
from auth.users
where email = 'REPLACE_WITH_REAL_EMAIL';
```
