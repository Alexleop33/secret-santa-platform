-- The referral form: what a family submits through a link, and the one
-- function that accepts it.
--
-- Three new tables hang off households:
--   household_members   one row per person — a role and an age, never a name
--   wish_items          one row per item, split out of the "needs" and
--                       "would love" text so a sponsor can tick them later
--   household_contacts  the family's email, in its own table so the February
--                       purge is one DELETE that touches nothing else, and
--                       so no donor-facing query can ever join to it
--
-- None of them has an INSERT policy. The only way a row gets in is
-- submit_referral() at the bottom, which checks the link, checks the text,
-- and writes everything in one transaction.

-- ---------- households grows ----------

alter table households
  add column story text not null default '',
  add column consent_wish_list boolean not null default false,
  add column consent_story boolean not null default false,
  -- The coordinator's private note (A2). Never shown to anyone else.
  add column admin_note text not null default '',
  add column updated_at timestamptz not null default now();

create trigger households_set_updated_at
before update on households
for each row execute function set_updated_at();

-- Ref codes are handed out in order of submission. Starts high enough to
-- clear the hand-written sandbox rows (#7, #14, #22).
create sequence household_ref_seq start 100;

-- ---------- household_members ----------

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  position integer not null,
  -- A role from a fixed list, never free text, so a name cannot be typed
  -- where a person's label goes. The page turns role + age into "Boy, 7".
  role text not null check (role in (
    'child', 'boy', 'girl', 'mom', 'dad', 'grandmother', 'grandfather', 'adult'
  )),
  age integer check (age between 0 and 120),
  clothing_size text not null default '' check (length(clothing_size) <= 40),
  shoe_size text not null default '' check (length(shoe_size) <= 40),
  constraint household_members_children_have_ages check (
    role not in ('child', 'boy', 'girl') or age is not null
  )
);

create index household_members_household_id_idx on household_members (household_id);

alter table household_members enable row level security;

create policy "household_members: admin reads"
on household_members for select
to authenticated
using ((select is_admin()));

-- ---------- wish_items ----------

create table wish_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  member_id uuid not null references household_members (id) on delete cascade,
  kind text not null check (kind in ('need', 'would_love')),
  label text not null check (length(label) between 1 and 60),
  position integer not null
);

create index wish_items_household_id_idx on wish_items (household_id);
create index wish_items_member_id_idx on wish_items (member_id);

alter table wish_items enable row level security;

create policy "wish_items: admin reads"
on wish_items for select
to authenticated
using ((select is_admin()));

-- ---------- household_contacts ----------

create table household_contacts (
  household_id uuid primary key references households (id) on delete cascade,
  email text not null check (length(email) <= 200 and email like '%_@_%'),
  created_at timestamptz not null default now()
);

alter table household_contacts enable row level security;

create policy "household_contacts: admin reads"
on household_contacts for select
to authenticated
using ((select is_admin()));

-- ---------- the text guard ----------

-- Looks for the three things that identify a family and should never be in
-- free text: a phone number, an email address, a street address. Returns
-- the first problem found, or null. Used on every free-text field of a
-- submission. Schools and surnames are a judgement call, so the approval
-- queue flags those for a human instead.
create or replace function identifying_text_problem(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text ~ '\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}' then 'a phone number'
    when p_text ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then 'an email address'
    when p_text ~* '\d+\s+[a-z]+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|ct|court|way|pl|place|cir|circle)\M' then 'a street address'
    else null
  end;
$$;

-- ---------- link status, for the page that opens the link ----------

-- 'valid', 'used', 'expired' or 'unknown'. Says nothing else about the link.
create or replace function referral_link_status(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
       when used_at is not null then 'used'
       when expires_at < now() then 'expired'
       else 'valid'
     end
     from public.referral_links
     where token_hash = sha256(convert_to(p_token, 'UTF8'))),
    'unknown'
  );
$$;

grant execute on function referral_link_status(text) to anon, authenticated;

-- ---------- the submission ----------

-- One call, one transaction. Either everything lands and the link is
-- burned, or nothing does. The link row is locked first (FOR UPDATE), so
-- two submissions racing on the same link queue up and the second one
-- finds it already used.
--
-- p_referral is JSON shaped like the form:
-- {
--   "summary": "Household of 4 — mom & three kids, ages 3–9",
--   "story": "…",
--   "email": "family@example.test",
--   "consent_wish_list": true,
--   "consent_story": false,
--   "members": [
--     {"role": "boy", "age": 7, "clothing_size": "Shirt 8", "shoe_size": "1",
--      "needs": "Winter coat, jeans", "would_love": "Dinosaur toys"}
--   ]
-- }
create or replace function submit_referral(p_token text, p_referral jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.referral_links%rowtype;
  v_household_id uuid;
  v_ref_code text;
  v_member jsonb;
  v_member_id uuid;
  v_position integer := 0;
  v_item text;
  v_item_position integer;
  v_problem text;
  v_text text;
begin
  -- The link.
  select * into v_link
  from public.referral_links
  where token_hash = sha256(convert_to(p_token, 'UTF8'))
  for update;

  if not found then
    raise exception 'This link is not recognised.';
  elsif v_link.used_at is not null then
    raise exception 'This link has already been used.';
  elsif v_link.expires_at < now() then
    raise exception 'This link has expired.';
  end if;

  if (select status from public.campaigns where id = v_link.campaign_id) <> 'open' then
    raise exception 'This drive is closed to new referrals.';
  end if;

  -- The shape.
  if coalesce(length(trim(p_referral->>'summary')), 0) not between 5 and 120 then
    raise exception 'Please describe the household in one line (up to 120 characters).';
  end if;
  if coalesce(length(p_referral->>'story'), 0) > 1500 then
    raise exception 'The story can be up to 1500 characters.';
  end if;
  if coalesce((p_referral->>'consent_wish_list')::boolean, false) is not true then
    raise exception 'An adult in the household needs to agree to share the wish list.';
  end if;
  if p_referral->>'email' is null or p_referral->>'email' not like '%_@_%' then
    raise exception 'Please give an email address the coordinator can reach you at.';
  end if;
  if jsonb_typeof(p_referral->'members') is distinct from 'array'
     or jsonb_array_length(p_referral->'members') not between 1 and 12 then
    raise exception 'Please list between one and twelve people.';
  end if;

  -- The text guard, on every free-text field.
  for v_text in
    select p_referral->>'summary'
    union all select p_referral->>'story'
    union all select m->>'needs' from jsonb_array_elements(p_referral->'members') m
    union all select m->>'would_love' from jsonb_array_elements(p_referral->'members') m
    union all select m->>'clothing_size' from jsonb_array_elements(p_referral->'members') m
    union all select m->>'shoe_size' from jsonb_array_elements(p_referral->'members') m
  loop
    v_problem := public.identifying_text_problem(coalesce(v_text, ''));
    if v_problem is not null then
      raise exception 'Please take out %: the coordinator can reach you by email instead.', v_problem;
    end if;
  end loop;

  -- The household.
  v_ref_code := '#' || nextval('public.household_ref_seq');

  insert into public.households (
    campaign_id, ref_code, summary, story, status, referred_on,
    consent_wish_list, consent_story
  ) values (
    v_link.campaign_id,
    v_ref_code,
    trim(p_referral->>'summary'),
    coalesce(trim(p_referral->>'story'), ''),
    'pending_review',
    now(),
    true,
    coalesce((p_referral->>'consent_story')::boolean, false)
  )
  returning id into v_household_id;

  -- The people, and their items.
  for v_member in select * from jsonb_array_elements(p_referral->'members') loop
    v_position := v_position + 1;

    insert into public.household_members (
      household_id, position, role, age, clothing_size, shoe_size
    ) values (
      v_household_id,
      v_position,
      v_member->>'role',
      nullif(v_member->>'age', '')::integer,
      coalesce(trim(v_member->>'clothing_size'), ''),
      coalesce(trim(v_member->>'shoe_size'), '')
    )
    returning id into v_member_id;

    -- "Winter coat, jeans" becomes two rows, so each can be ticked later.
    v_item_position := 0;
    for v_item in
      select trim(part) from unnest(string_to_array(coalesce(v_member->>'needs', ''), ',')) part
      where length(trim(part)) > 0
    loop
      v_item_position := v_item_position + 1;
      insert into public.wish_items (household_id, member_id, kind, label, position)
      values (v_household_id, v_member_id, 'need', left(v_item, 60), v_item_position);
    end loop;

    for v_item in
      select trim(part) from unnest(string_to_array(coalesce(v_member->>'would_love', ''), ',')) part
      where length(trim(part)) > 0
    loop
      v_item_position := v_item_position + 1;
      insert into public.wish_items (household_id, member_id, kind, label, position)
      values (v_household_id, v_member_id, 'would_love', left(v_item, 60), v_item_position);
    end loop;
  end loop;

  -- The one piece of contact data, in its own table.
  insert into public.household_contacts (household_id, email)
  values (v_household_id, lower(trim(p_referral->>'email')));

  -- Burn the link.
  update public.referral_links
  set used_at = now(), household_id = v_household_id
  where id = v_link.id;

  return v_ref_code;
end;
$$;

grant execute on function submit_referral(text, jsonb) to anon, authenticated;
