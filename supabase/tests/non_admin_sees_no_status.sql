-- The referrals page now shows approved and rejected households as well as
-- pending ones, with no change to the policy. This proves the policy still
-- returns nothing to a signed-in non-admin in each of the three statuses —
-- so all three sections stay empty for anyone but the admin, not just the
-- queue. One assertion per status, because a policy that filtered on
-- status would pass a single "count everything" check by accident.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (ref_code, summary, status, referred_on, consent_wish_list) values
  ('#t1', 'test household, pending', 'pending_review', now(), true),
  ('#t2', 'test household, live', 'live', now(), true),
  ('#t3', 'test household, rejected', 'rejected', now(), true);

-- Become "someone": signed in, no profiles row.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from households where status = 'pending_review'),
  0::bigint,
  'a non-admin sees no pending households'
);

select is(
  (select count(*) from households where status = 'live'),
  0::bigint,
  'a non-admin sees no approved households'
);

select is(
  (select count(*) from households where status = 'rejected'),
  0::bigint,
  'a non-admin sees no rejected households'
);

select * from finish();
rollback;
