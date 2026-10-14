-- Lets the admin resolve a pending referral. The check constraint closes
-- off any status a policy or query doesn't know how to handle; the policy
-- is the only way a household's status can actually change.

alter table households
  add constraint households_status_check
  check (status in ('pending_review', 'live', 'rejected'));

create policy "households: admin approves or rejects"
on households for update
to authenticated
using (
  status = 'pending_review'
  and exists (
    select 1 from profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
)
with check (status in ('live', 'rejected'));
