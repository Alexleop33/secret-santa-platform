-- Two things: the activity log, and withdrawing a live household.
--
-- The activity log is written by triggers, never by pages. A page can be
-- bypassed; a trigger fires for every change however it was made. Each
-- entry names the actor by role and account id, the action, and the
-- household's ref code — never a name, because there are none.

create table activity (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references campaigns (id),
  happened_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null check (actor_role in ('admin', 'donor', 'family', 'system')),
  action text not null,
  target_ref_code text not null,
  detail text not null default ''
);

create index activity_campaign_happened_idx on activity (campaign_id, happened_at desc);

alter table activity enable row level security;

create policy "activity: admin reads"
on activity for select
to authenticated
using ((select is_admin()));

-- Who is acting, as far as the database can tell:
--   no JWT at all          → 'system'  (a migration, a test, a direct change)
--   a JWT with no user id  → 'family'  (the anonymous key: the referral form)
--   the admin's user id    → 'admin'
--   any other user id      → 'donor'
create or replace function current_actor_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return 'system';
  elsif (select auth.uid()) is null then
    return 'family';
  elsif public.is_admin() then
    return 'admin';
  else
    return 'donor';
  end if;
end;
$$;

create or replace function log_household_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'referral_submitted';
  elsif new.status is distinct from old.status then
    v_action := case new.status
      when 'live' then 'approved'
      when 'rejected' then 'rejected'
      when 'withdrawn' then 'withdrawn'
      else 'status_' || new.status
    end;
  else
    return new;
  end if;

  insert into public.activity (campaign_id, actor_id, actor_role, action, target_ref_code)
  values (new.campaign_id, (select auth.uid()), public.current_actor_role(), v_action, new.ref_code);
  return new;
end;
$$;

create trigger households_log_activity
after insert or update of status on households
for each row execute function log_household_activity();

-- Withdrawing: a live household comes off the public list for good. A
-- second UPDATE policy, because the first only covers pending rows.
-- Permissive policies OR together: a row passes if either one allows it.
create policy "households: admin withdraws a live household"
on households for update
to authenticated
using (
  status = 'live'
  and (select is_admin())
)
with check (
  status in ('live', 'withdrawn')
  and (select is_admin())
);

-- The state machine, in one place. Permissive policies OR together: with
-- two UPDATE policies, a live row would pass the second policy's row filter
-- and the first policy's new-row check, and live → rejected would slip
-- through. So the policies decide *which rows* the admin may touch, and
-- this trigger decides *which changes* are allowed:
--
--   pending_review → live, rejected      (a decision)
--   live           → withdrawn           (taken off the list)
--   anything       → the same status     (a note-only save)
--
-- Everything else is refused with the same error RLS would give.
create or replace function enforce_household_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
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

create trigger households_enforce_transition
before update of status on households
for each row execute function enforce_household_transition();
