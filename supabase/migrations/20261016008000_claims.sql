-- Sponsoring: a donor claims a household, ticks items as they buy them,
-- marks the gifts delivered, or releases the household back to the list.
--
-- Every write goes through a function that checks the caller itself. No
-- donor policy exists on claims or wish_items, and donors read their own
-- claims through views filtered by auth.uid(). One pattern, four actions.
--
-- The race: two donors confirm the same household at once. The partial
-- unique index from the previous migration allows one active claim per
-- household, so the second INSERT fails and the function turns that into
-- 'already_claimed' for the page to show (D9).

alter table wish_items add column bought_at timestamptz;

-- ---------- what a donor reads ----------

create view my_claims
with (security_barrier = true) as
  select
    c.id, c.household_id, c.status, c.claimed_at, c.delivered_at, c.released_at,
    h.ref_code, h.summary,
    case when h.consent_story then h.story end as story
  from claims c
  join households h on h.id = c.household_id
  where c.donor_id = (select auth.uid());

create view my_household_members
with (security_barrier = true) as
  select m.id, m.household_id, m.position, m.role, m.age, m.clothing_size, m.shoe_size
  from household_members m
  where m.household_id in (
    select household_id from claims
    where donor_id = (select auth.uid()) and status in ('claimed', 'delivered')
  );

create view my_wish_items
with (security_barrier = true) as
  select w.id, w.household_id, w.member_id, w.kind, w.label, w.position, w.bought_at
  from wish_items w
  where w.household_id in (
    select household_id from claims
    where donor_id = (select auth.uid()) and status in ('claimed', 'delivered')
  );

grant select on my_claims, my_household_members, my_wish_items to authenticated;

-- ---------- what the admin reads ----------
--
-- Claims with the sponsor's email, which is in scope (CLAUDE.md: donor
-- emails are fine). Only the admin gets rows; everyone else gets none.

create view claims_with_sponsor
with (security_barrier = true) as
  select
    c.id, c.household_id, c.donor_id, c.sponsor_label, c.status,
    c.claimed_at, c.delivered_at, c.released_at,
    h.ref_code, h.summary, u.email as sponsor_email
  from claims c
  join households h on h.id = c.household_id
  left join auth.users u on u.id = c.donor_id
  where (select is_admin());

grant select on claims_with_sponsor to authenticated;

-- ---------- the log and the state machine ----------

create or replace function log_claim_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'claimed';
  elsif new.status is distinct from old.status then
    v_action := new.status;
  else
    return new;
  end if;

  insert into public.activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
  select h.campaign_id, (select auth.uid()), public.current_actor_role(), v_action, h.ref_code,
         case when new.sponsor_label <> '' then 'offline sponsor' else '' end
  from public.households h
  where h.id = new.household_id;
  return new;
end;
$$;

create trigger claims_log_activity
after insert or update of status on claims
for each row execute function log_claim_activity();

create or replace function enforce_claim_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'claimed' and new.status = 'delivered' then
    new.delivered_at := now();
    return new;
  end if;
  if old.status = 'claimed' and new.status = 'released' then
    new.released_at := now();
    return new;
  end if;
  raise exception 'A % claim cannot become %', old.status, new.status
    using errcode = '42501';
end;
$$;

create trigger claims_enforce_transition
before update of status on claims
for each row execute function enforce_claim_transition();

-- ---------- the four donor actions ----------

create or replace function claim_household(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_donor uuid := (select auth.uid());
  v_household public.households%rowtype;
  v_campaign public.campaigns%rowtype;
  v_active integer;
  v_id uuid;
begin
  if v_donor is null then
    raise exception 'Sign in to sponsor a family.' using errcode = '42501';
  end if;

  select * into v_household from public.households where id = p_household_id;
  if not found or v_household.status <> 'live' then
    raise exception 'This household is not available to sponsor.';
  end if;

  select * into v_campaign from public.campaigns where id = v_household.campaign_id;
  if v_campaign.status <> 'open' or v_campaign.claims_close < current_date then
    raise exception 'Claims have closed for this season.';
  end if;

  select count(*) into v_active
  from public.claims
  where donor_id = v_donor and status in ('claimed', 'delivered');
  if v_active >= v_campaign.sponsor_cap then
    raise exception 'You have reached the limit of % household% per sponsor.',
      v_campaign.sponsor_cap, case when v_campaign.sponsor_cap = 1 then '' else 's' end;
  end if;

  -- A donor's profile row appears on their first claim. It grants nothing;
  -- it only says what kind of account this is.
  insert into public.profiles (id, role) values (v_donor, 'donor')
  on conflict (id) do nothing;

  begin
    insert into public.claims (household_id, donor_id)
    values (p_household_id, v_donor)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_claimed' using errcode = 'P0002';
  end;

  return v_id;
end;
$$;

create or replace function mark_delivered(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.claims
  set status = 'delivered'
  where id = p_claim_id and donor_id = (select auth.uid()) and status = 'claimed';
  if not found then
    raise exception 'That claim is not yours to mark delivered.' using errcode = '42501';
  end if;
end;
$$;

create or replace function release_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.claims
  set status = 'released'
  where id = p_claim_id and donor_id = (select auth.uid()) and status = 'claimed';
  if not found then
    raise exception 'That claim is not yours to release.' using errcode = '42501';
  end if;
end;
$$;

create or replace function set_item_bought(p_item_id uuid, p_bought boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wish_items w
  set bought_at = case when p_bought then now() end
  where w.id = p_item_id
    and exists (
      select 1 from public.claims c
      where c.household_id = w.household_id
        and c.donor_id = (select auth.uid())
        and c.status in ('claimed', 'delivered')
    );
  if not found then
    raise exception 'That item is not on a household you sponsor.' using errcode = '42501';
  end if;
end;
$$;

-- Drop-off details: the one private campaign field a donor may see, and
-- only once they hold a claim. The admin sees it too.
create or replace function drop_off_details()
returns table (drop_off_address text, drop_off_hours text, gifts_due date, coordinator_name text, contact_email text, contact_phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.drop_off_address, c.drop_off_hours, c.gifts_due, c.coordinator_name, c.contact_email, c.contact_phone
  from public.campaigns c
  where public.is_admin()
     or exists (
       select 1 from public.claims cl
       where cl.donor_id = (select auth.uid()) and cl.status in ('claimed', 'delivered')
     )
  limit 1;
$$;

-- The offline sponsor (A3): someone phoned the office. The admin records
-- the match so the roster stays the single source of truth.
create or replace function admin_manual_claim(p_household_id uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can record an offline sponsor' using errcode = '42501';
  end if;
  if (select status from public.households where id = p_household_id) is distinct from 'live' then
    raise exception 'This household is not available to sponsor.';
  end if;
  begin
    insert into public.claims (household_id, donor_id, sponsor_label)
    values (p_household_id, null, left(coalesce(trim(p_label), ''), 80))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_claimed' using errcode = 'P0002';
  end;
  return v_id;
end;
$$;

create or replace function admin_release_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can release a claim' using errcode = '42501';
  end if;
  update public.claims set status = 'released' where id = p_claim_id and status = 'claimed';
  if not found then
    raise exception 'That claim is not open.';
  end if;
end;
$$;

revoke execute on function
  claim_household(uuid), mark_delivered(uuid), release_claim(uuid),
  set_item_bought(uuid, boolean), drop_off_details(),
  admin_manual_claim(uuid, text), admin_release_claim(uuid)
from public, anon;

grant execute on function
  claim_household(uuid), mark_delivered(uuid), release_claim(uuid),
  set_item_bought(uuid, boolean), drop_off_details(),
  admin_manual_claim(uuid, text), admin_release_claim(uuid)
to authenticated;

-- A released household goes back on the list with a clean wish list: the
-- previous sponsor's ticks mean nothing to the next one. A trigger, so it
-- happens whether a donor or the admin did the releasing.
create or replace function clear_bought_on_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'released' and old.status is distinct from 'released' then
    update public.wish_items set bought_at = null where household_id = new.household_id;
  end if;
  return new;
end;
$$;

create trigger claims_clear_bought_on_release
after update of status on claims
for each row execute function clear_bought_on_release();
