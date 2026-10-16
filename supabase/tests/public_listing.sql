-- What the public can see: live, unclaimed households, their people and
-- items, and the story only with consent. Nothing pending, rejected,
-- withdrawn or claimed, and never a private column.
begin;
select plan(11);

insert into households (id, ref_code, summary, story, status, referred_on, consent_wish_list, consent_story, admin_note) values
  ('00000000-0000-4000-9000-000000000101', '#p1', 'live, story shared', 'our story', 'live', now(), true, true, 'private note'),
  ('00000000-0000-4000-9000-000000000102', '#p2', 'live, story private', 'secret story', 'live', now(), true, false, ''),
  ('00000000-0000-4000-9000-000000000103', '#p3', 'pending', 'x', 'pending_review', now(), true, true, ''),
  ('00000000-0000-4000-9000-000000000104', '#p4', 'rejected', 'x', 'rejected', now(), true, true, ''),
  ('00000000-0000-4000-9000-000000000105', '#p5', 'withdrawn', 'x', 'withdrawn', now(), true, true, ''),
  ('00000000-0000-4000-9000-000000000106', '#p6', 'live but claimed', 'x', 'live', now(), true, true, '');

insert into household_members (id, household_id, position, role, age, clothing_size, shoe_size) values
  ('00000000-0000-4000-9100-000000000101', '00000000-0000-4000-9000-000000000101', 1, 'boy', 7, 'Shirt 8', 'Size 1'),
  ('00000000-0000-4000-9100-000000000103', '00000000-0000-4000-9000-000000000103', 1, 'girl', 5, '5T', 'Size 10');

insert into wish_items (household_id, member_id, kind, label, position) values
  ('00000000-0000-4000-9000-000000000101', '00000000-0000-4000-9100-000000000101', 'need', 'Winter coat', 1),
  ('00000000-0000-4000-9000-000000000103', '00000000-0000-4000-9100-000000000103', 'need', 'Boots', 1);

insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000101', 'p1@example.test');

-- #p6 has an active claim, so it is off the list.
insert into claims (household_id, status) values
  ('00000000-0000-4000-9000-000000000106', 'claimed');

set local role anon;

select is(
  (select count(*) from public_households where ref_code in ('#p1', '#p2', '#p3', '#p4', '#p5', '#p6')),
  2::bigint,
  'anon sees exactly the live, unclaimed households'
);

select is(
  (select count(*) from public_households where ref_code in ('#p3', '#p4', '#p5', '#p6')),
  0::bigint,
  'pending, rejected, withdrawn and claimed households are not listed'
);

select is(
  (select story from public_households where ref_code = '#p1'),
  'our story',
  'a story the family consented to is shown'
);

select is(
  (select story from public_households where ref_code = '#p2'),
  null,
  'a story the family did not consent to is withheld'
);

select hasnt_column('public', 'public_households', 'admin_note', 'the public view has no admin note');
select hasnt_column('public', 'public_households', 'consent_story', 'the public view has no consent flags');

select is(
  (select count(*) from public_household_members where household_id = '00000000-0000-4000-9000-000000000101'),
  1::bigint,
  'members of a listed household are visible'
);

select is(
  (select count(*) from public_household_members where household_id = '00000000-0000-4000-9000-000000000103'),
  0::bigint,
  'members of an unlisted household are not'
);

select is(
  (select count(*) from public_wish_items where household_id = '00000000-0000-4000-9000-000000000103'),
  0::bigint,
  'items of an unlisted household are not visible'
);

select is(
  (select count(*) from household_contacts),
  0::bigint,
  'anon still reads no contact rows'
);

select is(
  (select count(*) from claims),
  0::bigint,
  'anon reads no claims'
);

reset role;
select * from finish();
rollback;
