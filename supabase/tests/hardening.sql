-- The sweep: a signed-in non-admin (a donor) reads zero rows directly from
-- every table that is not theirs, whatever views exist on top; and the
-- consent gate holds in the database, not just on the page.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000011', 'donor-a@example.test');
insert into profiles (id, role) values
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000011', 'donor');
insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000501', '#h1', 'no consent', 'pending_review', now(), false),
  ('00000000-0000-4000-9000-000000000502', '#h2', 'live', 'live', now(), true);
insert into household_members (id, household_id, position, role, age) values
  ('00000000-0000-4000-9100-000000000501', '00000000-0000-4000-9000-000000000502', 1, 'boy', 7);
insert into wish_items (household_id, member_id, kind, label, position) values
  ('00000000-0000-4000-9000-000000000502', '00000000-0000-4000-9100-000000000501', 'need', 'Coat', 1);
insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000502', 'h2@example.test');
insert into referral_links (token_hash, expires_at) values
  (sha256(convert_to('hardening-token', 'UTF8')), now() + interval '1 day');
insert into claims (household_id, donor_id) values
  ('00000000-0000-4000-9000-000000000502', '00000000-0000-4000-8000-000000000001');

-- The consent gate, as the database itself (so RLS is not what refuses).
select throws_ok(
  $$ update households set status = 'live' where ref_code = '#h1' $$,
  '42501',
  'A household cannot go live without the wish-list consent',
  'a household cannot go live without the wish-list consent'
);

-- A donor, reading the tables directly.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);

select is((select count(*) from households), 0::bigint, 'a donor reads no households directly');
select is((select count(*) from household_members), 0::bigint, 'a donor reads no household members directly');
select is((select count(*) from wish_items), 0::bigint, 'a donor reads no wish items directly');
select is((select count(*) from household_contacts), 0::bigint, 'a donor reads no contact rows');
select is((select count(*) from claims), 0::bigint, 'a donor reads no claims directly, not even the admin''s');
select is((select count(*) from referral_links), 0::bigint, 'a donor reads no referral links');
select is((select count(*) from activity), 0::bigint, 'a donor reads no activity');
select is((select count(*) from campaigns), 0::bigint, 'a donor reads no campaign rows directly');
select is((select count(*) from profiles), 1::bigint, 'a donor reads exactly their own profile row');

reset role;
select * from finish();
rollback;
