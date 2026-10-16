-- Referral links: the credential a family uses to open the referral form.
--
-- A link is a random token. The table never stores the token itself, only
-- its SHA-256 hash, the same way a password-reset token is stored: a copy
-- of the database does not hand anyone a set of working links. The plain
-- token exists exactly once, in the admin's browser the moment the link is
-- created, and then only in whatever email the admin pastes it into.
--
-- No INSERT, UPDATE or DELETE policy exists on purpose. Rows are created by
-- create_referral_link() below and burned by the family's submission (a
-- later migration), both `security definer` functions that do their own
-- checks. The REST API can read the table (admin only) and nothing else.

create extension if not exists pgcrypto with schema extensions;

create table referral_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null default '00000000-0000-4000-a000-000000002026'
    references campaigns (id),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Set when a family submits through the link. Nothing about the family
  -- is here; the household row is where the referral lives.
  household_id uuid references households (id),
  -- Which admin account made the link. An account id, never a name.
  created_by uuid references auth.users (id)
);

create index referral_links_campaign_id_idx on referral_links (campaign_id);
create index referral_links_household_id_idx on referral_links (household_id);

alter table referral_links enable row level security;

create policy "referral_links: admin reads"
on referral_links for select
to authenticated
using ((select is_admin()));

-- Makes a link. Returns the plain token once; stores only its hash.
-- Seven days from creation, not from first open (decided 2026-10-13).
create or replace function create_referral_link()
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can create referral links'
      using errcode = '42501';
  end if;

  -- 24 random bytes as 48 hex characters: URL-safe, no padding, and far
  -- more than enough entropy for something that lives seven days.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + interval '7 days';

  insert into public.referral_links (token_hash, expires_at, created_by)
  values (sha256(convert_to(v_token, 'UTF8')), v_expires, (select auth.uid()))
  returning referral_links.id into v_id;

  return query select v_id, v_token, v_expires;
end;
$$;

-- Only a signed-in caller can even ask; the function then insists on the
-- admin. Anonymous callers get "permission denied" before the body runs.
revoke execute on function create_referral_link() from public, anon;
grant execute on function create_referral_link() to authenticated;
