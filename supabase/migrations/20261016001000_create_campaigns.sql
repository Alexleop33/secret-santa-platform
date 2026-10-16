-- Campaigns: one row per drive. v1 has exactly one, created at the bottom of
-- this file with bracketed placeholders. The admin types the real values in
-- on the live site under Drive settings; they never enter this repo.
--
-- Two kinds of column live here on purpose:
--   public   dates, names, contact line, the public-count toggle. Anyone may
--            read these through the public_campaign view below — the landing
--            page needs them before anyone signs in.
--   private  drop-off address and hours. Only the admin reads the table
--            directly. Donors get them after claiming, through a function
--            that checks the claim (a later migration).

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  organization_name text not null default '[Organization name]',
  coordinator_name text not null default '[Coordinator name]',
  contact_email text not null default 'coordinator@example.test',
  contact_phone text not null default '[phone]',
  drop_off_address text not null default '[Drop-off address]',
  drop_off_hours text not null default '[Drop-off hours]',
  nominations_open date not null,
  nominations_close date not null,
  claims_close date not null,
  gifts_due date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  sponsor_cap integer not null default 2 check (sponsor_cap between 1 and 5),
  show_public_count boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint campaigns_dates_in_order check (
    nominations_open <= nominations_close
    and nominations_close <= claims_close
    and claims_close <= gifts_due
  )
);

alter table campaigns enable row level security;

-- is_admin(): the one question every admin policy asks. Written once so
-- later policies read as `is_admin()` instead of repeating the subquery.
-- `security definer` lets it read profiles regardless of the caller's own
-- policies; it only ever reports on the caller's own row, so that is safe.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  );
$$;

create policy "campaigns: admin reads"
on campaigns for select
to authenticated
using ((select is_admin()));

create policy "campaigns: admin updates"
on campaigns for update
to authenticated
using ((select is_admin()))
with check ((select is_admin()));

-- updated_at keeps itself current. Reused by later tables.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger campaigns_set_updated_at
before update on campaigns
for each row execute function set_updated_at();

-- The 2026 drive. A fixed id, so this and later migrations can refer to it.
insert into campaigns (id, name, year, nominations_open, nominations_close, claims_close, gifts_due)
values (
  '00000000-0000-4000-a000-000000002026', 'Sub for Santa', 2026,
  '2026-10-20', '2026-11-06', '2026-11-30', '2026-12-14'
);

-- Every household belongs to a campaign. Rows that already exist join the
-- 2026 drive through the default.
alter table households
  add column campaign_id uuid not null
    default '00000000-0000-4000-a000-000000002026'
    references campaigns (id);

create index households_campaign_id_idx on households (campaign_id);

-- What the public may know about the drive. A view rather than a policy,
-- because RLS hides *rows* and this has to hide *columns*: the drop-off
-- address and hours are not in the list below, so they cannot come out.
-- The view runs as its owner, so it sees the table whoever is asking.
create view public_campaign
with (security_barrier = true) as
  select
    id, name, year, organization_name, coordinator_name, contact_email,
    contact_phone, nominations_open, nominations_close, claims_close,
    gifts_due, status, show_public_count, sponsor_cap
  from campaigns;

grant select on public_campaign to anon, authenticated;
