-- Closing the drive, and the retention purge.
--
-- A closed campaign has an empty public list and refuses new claims (the
-- claim function already checks status; the views now do too). Nothing is
-- deleted by closing. The purge is a separate, deliberate step: a function
-- that deletes the family contact rows, run by an approved GitHub Action,
-- never by hand (docs/break-glass.md).

create or replace view public_households
with (security_barrier = true) as
  select
    h.id,
    h.campaign_id,
    h.ref_code,
    h.summary,
    case when h.consent_story then h.story end as story,
    h.referred_on
  from households h
  join campaigns c on c.id = h.campaign_id
  where h.status = 'live'
    and c.status = 'open'
    and not exists (
      select 1 from claims cl
      where cl.household_id = h.id and cl.status in ('claimed', 'delivered')
    );

-- Season totals for the close-out card, admin only.
create view season_totals
with (security_barrier = true) as
  select
    c.id as campaign_id,
    (select count(*) from claims cl join households h on h.id = cl.household_id
      where h.campaign_id = c.id and cl.status in ('claimed', 'delivered')) as sponsored,
    (select count(*) from claims cl join households h on h.id = cl.household_id
      where h.campaign_id = c.id and cl.status = 'delivered') as delivered,
    (select count(*) from public_households p where p.campaign_id = c.id) as still_open,
    (select count(*) from households h where h.campaign_id = c.id and h.status = 'withdrawn') as withdrawn,
    (select count(*) from households h where h.campaign_id = c.id and h.status = 'rejected') as rejected,
    (select count(*) from activity a where a.campaign_id = c.id) as logged_events,
    (select count(*) from household_contacts hc join households h on h.id = hc.household_id
      where h.campaign_id = c.id) as contact_rows_held
  from campaigns c
  where (select is_admin());

grant select on season_totals to authenticated;

-- The retention purge. Deletes every family contact row for a closed
-- campaign and logs that it happened. Refuses to run on an open campaign:
-- close the drive first, on purpose, then purge, on purpose.
--
-- Callable only by the database owner (the GitHub Action connects as
-- postgres). Not granted to anon or authenticated: no page can call it.
create or replace function purge_retained_contacts(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_deleted integer;
begin
  select status into v_status from public.campaigns where id = p_campaign_id;
  if v_status is distinct from 'closed' then
    raise exception 'Close the drive before purging its contact rows.';
  end if;

  with gone as (
    delete from public.household_contacts hc
    using public.households h
    where h.id = hc.household_id and h.campaign_id = p_campaign_id
    returning hc.household_id
  )
  select count(*) into v_deleted from gone;

  insert into public.activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
  values (p_campaign_id, null, 'system', 'contacts_purged', '—', v_deleted || ' contact rows deleted');

  return v_deleted;
end;
$$;

revoke execute on function purge_retained_contacts(uuid) from public, anon, authenticated;
