-- Hardening before the demo site goes to anyone: the consent gate becomes
-- a database rule, not just a disabled button.
--
-- A household may only become live if an adult in it agreed to share the
-- wish list (decided 2026-10-10: consent gates publishing). The approval
-- page already disables Approve without it; this makes the database
-- refuse too, whichever page or tool asks.

create or replace function enforce_household_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'live' and new.consent_wish_list is not true then
    raise exception 'A household cannot go live without the wish-list consent'
      using errcode = '42501';
  end if;
  if (old.status, new.status) in (
    ('pending_review', 'live'),
    ('pending_review', 'rejected'),
    ('live', 'withdrawn')
  ) then
    return new;
  end if;
  raise exception 'A % household cannot become %', old.status, new.status
    using errcode = '42501';
end;
$$;
