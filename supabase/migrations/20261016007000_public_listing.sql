-- The public list: what anyone may see about a live household, and the
-- claims table that decides whether a household is still on it.
--
-- Anonymous readers never get a policy on households, household_members
-- or wish_items. A policy lets rows through whole, and a household row
-- carries the admin's note and the consent flags. So the public reads
-- three views that select only the public columns of households that are
-- live and unclaimed. The story comes through only where the family
-- ticked the story consent.

-- ---------- claims ----------
--
-- One row per sponsorship. A household has at most one *active* claim
-- (claimed or delivered) at a time — the partial unique index below is
-- the rule, and the thing that makes two donors racing for one household
-- safe: the second insert fails on the index. Released claims stay as
-- history. donor_id is null for an offline sponsor the admin records.

create table claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  donor_id uuid references auth.users (id),
  sponsor_label text not null default '' check (length(sponsor_label) <= 80),
  status text not null default 'claimed' check (status in ('claimed', 'delivered', 'released')),
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index claims_one_active_per_household
  on claims (household_id)
  where status in ('claimed', 'delivered');

create index claims_donor_id_idx on claims (donor_id);
create index claims_household_id_idx on claims (household_id);

alter table claims enable row level security;

create policy "claims: admin reads"
on claims for select
to authenticated
using ((select is_admin()));

create trigger claims_set_updated_at
before update on claims
for each row execute function set_updated_at();

-- ---------- the public views ----------

create view public_households
with (security_barrier = true) as
  select
    h.id,
    h.campaign_id,
    h.ref_code,
    h.summary,
    case when h.consent_story then h.story end as story,
    h.referred_on
  from households h
  where h.status = 'live'
    and not exists (
      select 1 from claims c
      where c.household_id = h.id and c.status in ('claimed', 'delivered')
    );

create view public_household_members
with (security_barrier = true) as
  select m.id, m.household_id, m.position, m.role, m.age, m.clothing_size, m.shoe_size
  from household_members m
  where m.household_id in (select id from public_households);

create view public_wish_items
with (security_barrier = true) as
  select w.id, w.household_id, w.member_id, w.kind, w.label, w.position
  from wish_items w
  where w.household_id in (select id from public_households);

grant select on public_households, public_household_members, public_wish_items
  to anon, authenticated;

-- ---------- public_counts now knows about claims ----------

drop view public_counts;

create view public_counts
with (security_barrier = true) as
  select
    c.id as campaign_id,
    case when c.show_public_count then
      (select count(*) from public_households p where p.campaign_id = c.id)
    end as need_sponsor,
    case when c.show_public_count then
      (select count(*) from claims cl
       join households h on h.id = cl.household_id
       where h.campaign_id = c.id and cl.status in ('claimed', 'delivered'))
    end as sponsored,
    (select count(*) from households h where h.campaign_id = c.id and h.status = 'pending_review')
      as awaiting_review
  from campaigns c;

grant select on public_counts to anon, authenticated;
