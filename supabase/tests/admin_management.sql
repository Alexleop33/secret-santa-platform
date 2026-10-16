-- Admin management, both directions: anon and non-admins are refused on
-- every function; an admin can promote an existing account (even a donor),
-- invite an address that has no account yet, remove an admin, and revoke
-- an invite; the last admin cannot be removed; an invite promotes exactly
-- once on first sign-in; a removed admin reads nothing.
begin;
select plan(19);

-- The sandbox may already hold admins (make-admin, Drive settings use).
-- Inside this transaction they are removed, so "the last admin" means the
-- test's own. Rolled back at the end like everything else.
delete from profiles where role = 'admin';

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000011', 'donor-b@example.test'),
  ('00000000-0000-4000-8000-000000000012', 'nobody-c@example.test');
insert into profiles (id, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000011', 'donor');
insert into households (ref_code, summary, status, referred_on, consent_wish_list) values
  ('#a1', 'a household', 'live', now(), true);

-- ---------- anon ----------
set local role anon;
select throws_ok($$ select add_admin('x@example.test') $$, '42501', null, 'anon cannot add an admin');
select throws_ok($$ select * from list_admins() $$, '42501', null, 'anon cannot list admins');
reset role;

-- ---------- a donor ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok($$ select add_admin('x@example.test') $$, '42501', null, 'a donor cannot add an admin');
select throws_ok($$ select remove_admin('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a donor cannot remove an admin');
select throws_ok($$ select * from list_admins() $$, '42501', null, 'a donor cannot list admins');
select throws_ok($$ select revoke_invite('x@example.test') $$, '42501', null, 'a donor cannot revoke an invite');
reset role;

-- ---------- the admin ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(add_admin('  Donor-B@Example.test '), 'added', 'an existing account is promoted at once, whatever the casing');
-- Read the other account's row as the database: the admin's own policy
-- only lets her read her own profile row.
reset role;
select is((select role from profiles where id = '00000000-0000-4000-8000-000000000011'), 'admin', 'a donor row becomes an admin row, not skipped');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*) from list_admins() where kind = 'admin'), 2::bigint, 'the list shows both admins');

select is(add_admin('invitee@example.test'), 'invited', 'an address with no account becomes an invite');
select is(add_admin('invitee@example.test'), 'invited', 'inviting the same address again is harmless');
select is((select count(*) from list_admins() where kind = 'invite'), 1::bigint, 'one pending invite is listed');
select throws_ok($$ select add_admin('not an email') $$, 'P0001', 'Please give a valid email address.', 'a bad address is refused');

select lives_ok($$ select remove_admin('00000000-0000-4000-8000-000000000011') $$, 'the admin can remove another admin');
select throws_ok(
  $$ select remove_admin('00000000-0000-4000-8000-000000000001') $$,
  'P0001', 'Cannot remove the last admin. Add another admin first.',
  'the last admin cannot be removed, even by themselves'
);

select lives_ok($$ select add_admin('other@example.test') $$, 'a second invite');
select lives_ok($$ select revoke_invite('other@example.test') $$, 'the admin can revoke a pending invite');
reset role;

-- ---------- the removed admin reads nothing ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select is((select count(*) from households), 0::bigint, 'a removed admin reads no households');
reset role;

-- ---------- the invite fires on first sign-in ----------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000013', 'Invitee@example.test');
select is(
  (select role from profiles where id = '00000000-0000-4000-8000-000000000013'),
  'admin',
  'a new account whose email matches a pending invite is promoted on creation'
);

select * from finish();
rollback;
