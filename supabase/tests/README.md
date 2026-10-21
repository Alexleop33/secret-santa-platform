# RLS denial tests

Each `.sql` file here is a [pgTAP](https://pgtap.org) test, run by
`npm run test:db` (`supabase test db`) against the local Docker database.

**Why these exist:** a wrong RLS policy looks exactly like a right one. The
page renders, the query returns rows, nothing errors. The only way to know a
policy *denies* is to be the wrong user and ask. That is what each file does:

1. Insert its own fixtures — fake accounts in `auth.users`, a `profiles` row
   for the admin, a couple of `households`.
2. Become a role (`anon`, or `authenticated` with a specific user id in the
   JWT claims — the same thing Supabase does for a real request).
3. Count what comes back, or try a write and then check whether it landed.
4. Roll everything back. Tests never change the database.

No real data, ever. Emails are `*.test`, codes are `#t1`, `#t2`.

**One test per policy, both directions.** When a policy is added or changed,
its test changes in the same PR — the test is the deliverable, not the
policy.
