-- Once a referral is live or rejected, even the admin can't change its
-- status again through the app. The UPDATE policy only covers rows that are
-- still pending_review, and the table's check constraint only allows the
-- three known statuses. Both are tested here.
begin;
select plan(4);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000001', 'admin@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (ref_code, summary, status, referred_on, consent_wish_list) values
  ('#t1', 'test household, live', 'live', now(), true),
  ('#t2', 'test household, rejected', 'rejected', now(), true),
  ('#t3', 'test household, pending', 'pending_review', now(), true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- A live row is visible to the admin (she may withdraw it), but live →
-- rejected is not an allowed transition, so the trigger refuses it.
select throws_ok(
  $$ update households set status = 'rejected' where ref_code = '#t1' $$,
  '42501',
  null,
  'the admin cannot change a live referral to rejected'
);

-- A rejected row is covered by no policy at all, so the update sees no
-- rows and changes nothing, silently.
update households set status = 'live' where ref_code = '#t2';

-- A pending row can only move to live or rejected. Anything else is refused
-- outright — an error, not a silent no-op — so we assert on the error.
-- Two things would refuse it: the UPDATE policy's `with check` and the
-- table's check constraint. Postgres evaluates the RLS check first, so the
-- error we see is 42501 ("new row violates row-level security policy"),
-- not 23514 (check constraint). Either way the row doesn't change.
select throws_ok(
  $$ update households set status = 'bogus' where ref_code = '#t3' $$,
  '42501',
  null,
  'the admin cannot move a pending referral to an unknown status'
);

reset role;

select is(
  (select status from households where ref_code = '#t1'),
  'live',
  'the admin cannot change a live referral back'
);

select is(
  (select status from households where ref_code = '#t2'),
  'rejected',
  'the admin cannot change a rejected referral back'
);

select * from finish();
rollback;
