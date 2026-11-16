-- "Expire now": the admin can close a referral link before its date, so no
-- more referrals can come in through it. Asked for by the admin on
-- 2026-11-16, when a link that had gone out needed stopping the same day.
--
-- How it works: every check a link goes through already reads
-- `expires_at` — the form's status lookup and the submission function
-- both refuse a link whose date has passed. So closing a link is setting
-- that date into the past. No new rule to keep in step, no second place a
-- check could be forgotten.
--
-- `closed_at` / `closed_by` record that it was a person who stopped the
-- link, and when, so the links page can show "Closed" rather than let it
-- look like the date simply arrived. The activity log gets a line too.
--
-- The write still goes through a function, not an UPDATE policy: the table
-- keeps having exactly two writers, create_referral_link() and
-- submit_referral(), plus this.

alter table referral_links
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users (id);

create or replace function expire_referral_link(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.referral_links%rowtype;
  v_when timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can expire referral links'
      using errcode = '42501';
  end if;

  select * into v_link
  from public.referral_links
  where id = p_id
  for update;

  if not found then
    raise exception 'That link does not exist.';
  elsif v_link.uses >= v_link.max_uses then
    raise exception 'That link is already used up.';
  elsif v_link.expires_at < now() then
    raise exception 'That link has already expired.';
  end if;

  -- One second into the past, not exactly now: the checks ask "is the date
  -- before now?", and inside a single transaction now() does not move, so
  -- "exactly now" would still read as open until the next request.
  v_when := now() - interval '1 second';

  update public.referral_links
  set expires_at = v_when,
      closed_at = now(),
      closed_by = (select auth.uid())
  where id = p_id;

  perform public.log_admin_event(
    'referral_link_closed',
    'Link made ' || to_char(v_link.created_at, 'YYYY-MM-DD')
      || ', ' || v_link.uses || ' of ' || v_link.max_uses || ' uses, closed early'
  );

  return v_when;
end;
$$;

revoke execute on function expire_referral_link(uuid) from public, anon;
grant execute on function expire_referral_link(uuid) to authenticated;
