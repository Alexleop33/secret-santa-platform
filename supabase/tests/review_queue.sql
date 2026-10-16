-- The review slice: a note can be saved on a pending row, only status and
-- the note can change at all, and rejecting deletes the contact row while
-- approving keeps it.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000001', '#t1', 'test household, to approve', 'pending_review', now(), true),
  ('00000000-0000-4000-9000-000000000002', '#t2', 'test household, to reject', 'pending_review', now(), true);
insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000001', 'family-one@example.test'),
  ('00000000-0000-4000-9000-000000000002', 'family-two@example.test');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- A note on a pending row, without deciding it.
update households set admin_note = 'ask about sizes' where ref_code = '#t1';

select is(
  (select admin_note from households where ref_code = '#t1'),
  'ask about sizes',
  'the admin can save a private note on a pending referral'
);

select is(
  (select status from households where ref_code = '#t1'),
  'pending_review',
  'saving a note does not change the status'
);

-- The family's words cannot be edited, even by the admin.
select throws_ok(
  $$ update households set summary = 'rewritten' where ref_code = '#t1' $$,
  '42501',
  null,
  'the admin cannot edit a household summary'
);

select throws_ok(
  $$ update households set story = 'rewritten' where ref_code = '#t1' $$,
  '42501',
  null,
  'the admin cannot edit a household story'
);

-- Decide both.
update households set status = 'live' where ref_code = '#t1';
update households set status = 'rejected' where ref_code = '#t2';

select is(
  (select count(*) from household_contacts where household_id = '00000000-0000-4000-9000-000000000001'),
  1::bigint,
  'approving keeps the contact row'
);

select is(
  (select count(*) from household_contacts where household_id = '00000000-0000-4000-9000-000000000002'),
  0::bigint,
  'rejecting deletes the contact row'
);

reset role;

-- The trigger is the mechanism, so it must fire for any path, not just
-- the API: a direct update as the database itself deletes the row too.
insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000003', '#t3', 'test household, to withdraw', 'live', now(), true);
insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000003', 'family-three@example.test');
update households set status = 'withdrawn' where ref_code = '#t3';

select is(
  (select count(*) from household_contacts where household_id = '00000000-0000-4000-9000-000000000003'),
  0::bigint,
  'withdrawing deletes the contact row'
);

select * from finish();
rollback;
