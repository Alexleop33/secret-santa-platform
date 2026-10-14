-- UPDATE requires the resulting row to still satisfy the table's SELECT
-- policy, not just the UPDATE policy's own `with check`. The old policy
-- only let the admin see pending_review rows, so approving or rejecting
-- one made the new row unreadable under that same policy — Postgres
-- refuses the write outright rather than create a row nobody can read
-- back. The admin's visibility now covers every status; which rows the
-- queue screen actually shows is still decided by its own query
-- (.eq("status", "pending_review") in queue.js), not by this policy.

alter policy "households: admin reads pending referrals" on households
using (
  exists (
    select 1 from profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);
