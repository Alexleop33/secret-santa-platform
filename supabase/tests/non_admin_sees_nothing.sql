-- A signed-in account with no admin profile must see no households, must
-- not see anyone else's profile, and must not be able to resolve a referral.
-- "Signed in" here means the authenticated role plus a JWT whose `sub` is
-- the account's id — which is exactly what auth.uid() reads.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
-- Note: no profiles row for "someone". Most signed-in accounts have none.
insert into households (ref_code, summary, status, referred_on) values
  ('#t1', 'test household, pending', 'pending_review', now()),
  ('#t2', 'test household, live', 'live', now());

-- Become "someone".
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from households),
  0::bigint,
  'a non-admin sees no households'
);

select is(
  (select count(*) from profiles),
  0::bigint,
  'a non-admin with no profile sees no profiles — not even the admin''s'
);

update households set status = 'live' where ref_code = '#t1';
update households set status = 'rejected' where status = 'pending_review';
reset role;

select is(
  (select status from households where ref_code = '#t1'),
  'pending_review',
  'a non-admin cannot approve a pending referral'
);

select is(
  (select status from households where ref_code = '#t1'),
  'pending_review',
  'a non-admin cannot reject pending referrals either'
);

select * from finish();
rollback;
