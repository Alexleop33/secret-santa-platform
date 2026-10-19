-- The bootstrap admin, as part of the platform (decided 2026-10-19).
--
-- The first admin used to need a hand-run SQL statement against the live
-- database (docs/break-glass.md). Now the platform seeds an *invite* for
-- the bootstrap address: the moment that address first signs in with
-- Google, the existing invite trigger promotes it, and from then on every
-- other admin is added from the Admins page.
--
-- Why an invite and not "the first person to sign in becomes admin":
-- sign-up is open, so that would be a race against whoever finds the URL
-- first. An invite is bound to one address, so there is nothing to race.
-- If the address itself is wrong, break-glass fixes it; that is now what
-- break-glass is for.
--
-- The address is David's, which is already public in every commit of
-- this repository. If the account already exists (the dev project, where
-- he has signed in), it is promoted directly instead of invited.
do $$
declare
  v_email constant text := 'david@davidwelch.co';
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = v_email limit 1;

  if v_user is not null then
    insert into profiles (id, role) values (v_user, 'admin')
    on conflict (id) do update set role = 'admin';
    insert into activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
    values ((select id from campaigns order by year desc limit 1), null, 'system', 'admin_added', '—', v_email || ' (bootstrap)');
  else
    insert into admin_invites (email) values (v_email)
    on conflict (email) where used_at is null do nothing;
    insert into activity (campaign_id, actor_id, actor_role, action, target_ref_code, detail)
    values ((select id from campaigns order by year desc limit 1), null, 'system', 'admin_invited', '—', v_email || ' (bootstrap)');
  end if;
end;
$$;
