-- The approval queue, done properly (A2). Three changes:
--
-- 1. The admin may save a private note on a pending referral without
--    deciding it. The old UPDATE policy only allowed a change *to* live or
--    rejected, so a note-only save was refused. It now also allows a
--    pending row to stay pending.
-- 2. Through the API, only two columns of a household can ever change:
--    status and admin_note. The family's own words are never edited by
--    anyone. This is a column privilege, which RLS cannot express.
-- 3. Rejecting (or, later, withdrawing) a household deletes its contact
--    row — decided 2026-10-10. A trigger does it, so no page can forget.
--
-- 'withdrawn' joins the allowed statuses now; the page that uses it comes
-- in a later slice.

alter table households drop constraint households_status_check;
alter table households
  add constraint households_status_check
  check (status in ('pending_review', 'live', 'rejected', 'withdrawn'));

drop policy "households: admin approves or rejects" on households;

create policy "households: admin reviews pending referrals"
on households for update
to authenticated
using (
  status = 'pending_review'
  and (select is_admin())
)
with check (
  status in ('pending_review', 'live', 'rejected')
  and (select is_admin())
);

-- Column privileges: the API may change status and the note, nothing else.
-- anon loses UPDATE entirely; it never had a policy that let one through,
-- and now it does not get as far as the policy.
revoke update on households from anon, authenticated;
grant update (status, admin_note) on households to authenticated;

create or replace function delete_contact_on_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('rejected', 'withdrawn') and new.status is distinct from old.status then
    delete from public.household_contacts where household_id = new.id;
  end if;
  return new;
end;
$$;

create trigger households_delete_contact_on_rejection
after update of status on households
for each row execute function delete_contact_on_rejection();
