-- Every status change leaves an activity row naming who did it by role;
-- only the admin can read the log; the admin can withdraw a live household
-- and nothing else can be withdrawn or un-withdrawn.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

-- Inserted as the database itself: logged as 'system'.
insert into households (ref_code, summary, status, referred_on) values
  ('#t1', 'test household, pending', 'pending_review', now()),
  ('#t2', 'test household, live', 'live', now()),
  ('#t3', 'test household, rejected', 'rejected', now());

select is(
  (select count(*) from activity where target_ref_code in ('#t1', '#t2', '#t3') and action = 'referral_submitted' and actor_role = 'system'),
  3::bigint,
  'inserting a household logs referral_submitted by system'
);

-- The admin decides #t1 and withdraws #t2.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

update households set status = 'live' where ref_code = '#t1';
update households set status = 'withdrawn' where ref_code = '#t2';

select is(
  (select status from households where ref_code = '#t2'),
  'withdrawn',
  'the admin can withdraw a live household'
);

select is(
  (select actor_role || ':' || action from activity where target_ref_code = '#t1' and action <> 'referral_submitted'),
  'admin:approved',
  'approving logs admin:approved'
);

select is(
  (select actor_role || ':' || action from activity where target_ref_code = '#t2' and action <> 'referral_submitted'),
  'admin:withdrawn',
  'withdrawing logs admin:withdrawn'
);

select is(
  (select actor_id from activity where target_ref_code = '#t2' and action = 'withdrawn'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  'the entry carries the acting account id'
);

-- A rejected household cannot be withdrawn: no policy covers it, so the
-- update touches nothing.
update households set status = 'withdrawn' where ref_code = '#t3';
select is(
  (select status from households where ref_code = '#t3'),
  'rejected',
  'a rejected household cannot be withdrawn'
);

-- A withdrawn household cannot come back: no policy's USING covers it.
update households set status = 'live' where ref_code = '#t2';
select is(
  (select status from households where ref_code = '#t2'),
  'withdrawn',
  'a withdrawn household cannot be made live again'
);

select ok(
  (select count(*) from activity) >= 5,
  'the admin can read the activity log'
);

reset role;

-- A non-admin reads nothing.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is((select count(*) from activity), 0::bigint, 'a non-admin sees no activity');
reset role;

set local role anon;
select is((select count(*) from activity), 0::bigint, 'anon sees no activity');
reset role;

select * from finish();
rollback;
