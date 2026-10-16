-- Admin management: an admin adds and removes admins from inside the app.
-- Break-glass (docs/break-glass.md) stays for the very first admin only.
--
-- Who is an admin is a profiles row with role 'admin'. Adding by email
-- either promotes an existing account at once or records an *invite*:
-- the moment an account with that email first signs in, a trigger on
-- auth.users promotes it and marks the invite used. Invites can only be
-- created by admins, so there is no path to admin rights that does not
-- start with an existing admin.
--
-- The one guard that matters: the last admin cannot be removed, by anyone,
-- including themselves. Every call is logged.

create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  -- Stored lower-cased; the trigger compares lower(new.email) to it.
  email text not null check (
    email = lower(email) and email like '%_@_%' and length(email) <= 200
  ),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users (id)
);

-- One pending invite per email. A used one may be followed by a new one.
create unique index admin_invites_pending_email
  on admin_invites (email) where used_at is null;

alter table admin_invites enable row level security;

create policy "admin_invites: admin reads"
on admin_invites for select
to authenticated
using ((select is_admin()));

-- Every admin event goes to the activity log. The email travels in
-- `detail`; target_ref_code is for household codes only.
create or replace function log_admin_event(p_action text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
  values (
    (select id from public.campaigns order by year desc limit 1),
    (select auth.uid()),
    public.current_actor_role(),
    p_action,
    '—',
    p_detail
  );
$$;

revoke execute on function log_admin_event(text, text) from public, anon, authenticated;

-- add_admin: promote now, or invite for later. Returns which one happened.
create or replace function add_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can add admins' using errcode = '42501';
  end if;
  if v_email not like '%_@_%' or length(v_email) > 200 then
    raise exception 'Please give a valid email address.';
  end if;

  select id into v_user from auth.users where lower(email) = v_email limit 1;

  if v_user is not null then
    -- An existing donor row becomes admin; a missing row is created.
    insert into public.profiles (id, role) values (v_user, 'admin')
    on conflict (id) do update set role = 'admin';
    perform public.log_admin_event('admin_added', v_email);
    return 'added';
  end if;

  insert into public.admin_invites (email, invited_by)
  values (v_email, (select auth.uid()))
  on conflict (email) where used_at is null do nothing;
  perform public.log_admin_event('admin_invited', v_email);
  return 'invited';
end;
$$;

-- remove_admin: including yourself, never the last one.
create or replace function remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can remove admins' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'That account is not an admin.';
  end if;

  select count(*) into v_admins from public.profiles where role = 'admin';
  if v_admins <= 1 then
    raise exception 'Cannot remove the last admin. Add another admin first.';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  -- Log before the delete: removing yourself changes what the log would
  -- record as your role.
  perform public.log_admin_event('admin_removed', coalesce(v_email, p_user_id::text));
  delete from public.profiles where id = p_user_id;
end;
$$;

create or replace function revoke_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'Only an admin can revoke invites' using errcode = '42501';
  end if;
  delete from public.admin_invites where email = v_email and used_at is null;
  if not found then
    raise exception 'There is no pending invite for that address.';
  end if;
  perform public.log_admin_event('invite_revoked', v_email);
end;
$$;

-- list_admins: current admins and pending invites, for the Admins page.
create or replace function list_admins()
returns table (kind text, id uuid, email text, since timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can list admins' using errcode = '42501';
  end if;
  return query
    select 'admin'::text, p.id, u.email::text, u.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'admin'
    union all
    select 'invite'::text, i.id, i.email, i.created_at
    from public.admin_invites i
    where i.used_at is null
    order by 1, 4;
end;
$$;

revoke execute on function add_admin(text), remove_admin(uuid), revoke_invite(text), list_admins()
  from public, anon;
grant execute on function add_admin(text), remove_admin(uuid), revoke_invite(text), list_admins()
  to authenticated;

-- The invite fires on first sign-in: a new auth.users row whose email
-- matches a pending invite is promoted, once, and the invite is marked
-- used. Exact lower-cased match, nothing fuzzier.
create or replace function promote_invited_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite_id uuid;
begin
  select i.id into v_invite_id
  from public.admin_invites i
  where i.email = lower(new.email) and i.used_at is null
  limit 1;

  if v_invite_id is not null then
    insert into public.profiles (id, role) values (new.id, 'admin')
    on conflict (id) do update set role = 'admin';
    update public.admin_invites set used_at = now(), used_by = new.id where id = v_invite_id;
    insert into public.activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
    values (
      (select id from public.campaigns order by year desc limit 1),
      new.id, 'system', 'admin_added', '—', lower(new.email) || ' (by invite)'
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_promote_admin
after insert on auth.users
for each row execute function promote_invited_admin();
