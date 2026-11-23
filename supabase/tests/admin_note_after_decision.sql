-- The coordinator's note stays editable after a referral is decided (Epic
-- #27, slice 27b; Story #18). Nothing in the database changes for this:
-- the withdraw migration (20261016006000) already gave the admin an UPDATE
-- policy on live households, and its trigger allows a save that leaves the
-- status alone. These prove what the queue page now relies on:
--   - she can save her note on an approved family, sponsored or delivered
--     too: a claim never changes households.status, which stays 'live';
--   - a save on a rejected or withdrawn family changes nothing and hands
--     back no row, which is how the page knows to say "Not saved";
--   - an approved family can't be sent back to pending, and its summary
--     stays read-only;
--   - nobody but the admin can write the note.
-- The page's save is an update that asks for the row back. Each check
-- below does the same, and counts the rows it gets.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000001', '#t1', 'test household, needs a sponsor', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000002', '#t2', 'test household, sponsored', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000003', '#t3', 'test household, delivered', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000004', '#t4', 'test household, rejected', 'rejected', now(), true),
  ('00000000-0000-4000-9000-000000000005', '#t5', 'test household, withdrawn', 'withdrawn', now(), true);

insert into claims (household_id, status) values
  ('00000000-0000-4000-9000-000000000002', 'claimed'),
  ('00000000-0000-4000-9000-000000000003', 'delivered');

-- As the admin.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

with saved as (update households set admin_note = 'sizes confirmed by phone' where ref_code = '#t1' returning id)
select is((select count(*) from saved), 1::bigint, 'the admin saves a note on a family that needs a sponsor, and gets the row back');

select is(
  (select admin_note from households where ref_code = '#t1'),
  'sizes confirmed by phone',
  'the note is stored'
);

select is(
  (select status from households where ref_code = '#t1'),
  'live',
  'saving the note leaves the family approved'
);

with saved as (update households set admin_note = 'sponsor dropping off Friday' where ref_code = '#t2' returning id)
select is((select count(*) from saved), 1::bigint, 'the admin saves a note on a sponsored family');

with saved as (update households set admin_note = 'all bags in' where ref_code = '#t3' returning id)
select is((select count(*) from saved), 1::bigint, 'the admin saves a note on a family whose gifts were delivered');

with saved as (update households set admin_note = 'too late' where ref_code = '#t4' returning id)
select is((select count(*) from saved), 0::bigint, 'a note on a rejected family saves nothing, and no row comes back');

with saved as (update households set admin_note = 'too late' where ref_code = '#t5' returning id)
select is((select count(*) from saved), 0::bigint, 'a note on a withdrawn family saves nothing, and no row comes back');

select throws_ok(
  $$ update households set status = 'pending_review' where ref_code = '#t1' $$,
  '42501',
  null,
  'an approved family cannot be sent back to pending review'
);

select throws_ok(
  $$ update households set summary = 'rewritten' where ref_code = '#t1' $$,
  '42501',
  null,
  'an approved family''s summary stays read-only'
);

reset role;

select is(
  (select admin_note from households where ref_code = '#t4'),
  '',
  'the rejected family''s note is unchanged'
);

-- As a signed-in donor, who is not the admin: no policy lets them update
-- any household, so nothing matches and nothing changes.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

with saved as (update households set admin_note = 'not mine' where ref_code = '#t1' returning id)
select is((select count(*) from saved), 0::bigint, 'a signed-in non-admin cannot write the note');

reset role;

-- With the anonymous key: no UPDATE privilege on households at all.
set local role anon;

select throws_ok(
  $$ update households set admin_note = 'anon' where ref_code = '#t1' $$,
  '42501',
  null,
  'the anonymous key cannot write the note'
);

reset role;

select is(
  (select admin_note from households where ref_code = '#t1'),
  'sizes confirmed by phone',
  'after both attempts the note is still the admin''s'
);

select * from finish();
rollback;
