-- The happy path, so the denial tests mean something: the admin can read
-- households in every status, can read their own profile, and can approve
-- or reject a pending referral. If this file fails, the policies are
-- denying the one person they're meant to let through.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (ref_code, summary, status, referred_on) values
  ('#t1', 'test household, pending', 'pending_review', now()),
  ('#t2', 'test household, also pending', 'pending_review', now()),
  ('#t3', 'test household, live', 'live', now()),
  ('#t4', 'test household, rejected', 'rejected', now());

-- Become the admin.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Only this file's own rows are counted (seed.sql rows may be present too;
-- the tests don't depend on them either way).
select is(
  (select count(*) from households where ref_code in ('#t1', '#t2', '#t3', '#t4')),
  4::bigint,
  'the admin sees every household, whatever its status'
);

select is(
  (select role from profiles where id = '00000000-0000-4000-8000-000000000001'),
  'admin',
  'the admin can read their own profile row'
);

update households set status = 'live' where ref_code = '#t1';
update households set status = 'rejected' where ref_code = '#t2';
reset role;

select is(
  (select status from households where ref_code = '#t1'),
  'live',
  'the admin can approve a pending referral'
);

select is(
  (select status from households where ref_code = '#t2'),
  'rejected',
  'the admin can reject a pending referral'
);

select * from finish();
rollback;
