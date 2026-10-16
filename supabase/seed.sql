-- Sandbox fixtures only. Never run this against the production project —
-- these are fake rows for testing the queue, not real referrals. Every id
-- is fixed so the people and items below can point at their household.

insert into households (id, ref_code, summary, story, status, referred_on, consent_wish_list, consent_story) values
  ('00000000-0000-4000-9000-000000000014', '#14',
   'A family of four, two children, ages 6 and 9.',
   'Both kids outgrew last winter''s coats. Mom works evenings and has covered the household on one income since spring. Warm clothes first, then one thing each to open.',
   'pending_review', '2026-10-01 09:00:00+00', true, true),
  ('00000000-0000-4000-9000-000000000007', '#7',
   'A single parent with one toddler.',
   'Dad picked up a second shift in October to stay ahead of rent after childcare costs went up.',
   'pending_review', '2026-10-05 14:30:00+00', true, false),
  ('00000000-0000-4000-9000-000000000022', '#22',
   'Two adults, no children, first time referring.',
   'Seasonal work ended early this year. Asking for warm things to get through the winter.',
   'pending_review', '2026-10-10 11:15:00+00', true, true);

insert into household_members (id, household_id, position, role, age, clothing_size, shoe_size) values
  ('00000000-0000-4000-9100-000000000001', '00000000-0000-4000-9000-000000000014', 1, 'boy', 6, 'Shirt 6', 'Size 12'),
  ('00000000-0000-4000-9100-000000000002', '00000000-0000-4000-9000-000000000014', 2, 'girl', 9, 'Shirt 10', 'Size 3'),
  ('00000000-0000-4000-9100-000000000003', '00000000-0000-4000-9000-000000000014', 3, 'mom', null, 'Women''s M', ''),
  ('00000000-0000-4000-9100-000000000004', '00000000-0000-4000-9000-000000000007', 1, 'child', 2, '2T', 'Size 6'),
  ('00000000-0000-4000-9100-000000000005', '00000000-0000-4000-9000-000000000007', 2, 'dad', null, 'Men''s L', ''),
  ('00000000-0000-4000-9100-000000000006', '00000000-0000-4000-9000-000000000022', 1, 'adult', null, 'Women''s L', 'Size 8'),
  ('00000000-0000-4000-9100-000000000007', '00000000-0000-4000-9000-000000000022', 2, 'adult', null, 'Men''s M', 'Size 10');

insert into wish_items (household_id, member_id, kind, label, position) values
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000001', 'need', 'Winter coat', 1),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000001', 'need', 'Snow boots', 2),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000001', 'would_love', 'Building blocks', 3),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000002', 'need', 'Winter coat', 1),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000002', 'would_love', 'Art supplies', 2),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000002', 'would_love', 'Chapter books', 3),
  ('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-9100-000000000003', 'need', 'Grocery gift card', 1),
  ('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-9100-000000000004', 'need', 'Diapers size 5', 1),
  ('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-9100-000000000004', 'need', 'Winter hat', 2),
  ('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-9100-000000000004', 'would_love', 'Stacking toys', 3),
  ('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-9100-000000000005', 'need', 'Grocery gift card', 1),
  ('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-9100-000000000006', 'need', 'Warm socks', 1),
  ('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-9100-000000000006', 'need', 'Gloves', 2),
  ('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-9100-000000000007', 'need', 'Winter coat', 1),
  ('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-9100-000000000007', 'would_love', 'A good book', 2);

-- Fake contact emails, one per sandbox household. The .test domain can
-- never be delivered to.
insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000014', 'family-14@example.test'),
  ('00000000-0000-4000-9000-000000000007', 'family-7@example.test'),
  ('00000000-0000-4000-9000-000000000022', 'family-22@example.test');

-- The sandbox drive's contact details. Obviously fake: no real person,
-- address or phone number. The live site gets its real values typed in by
-- the admin under Drive settings, never from a file in this repo.
update campaigns set
  organization_name = 'Example Neighbors',
  coordinator_name = 'Sample Coordinator',
  contact_email = 'coordinator@example.test',
  contact_phone = '(555) 010-0000',
  drop_off_address = 'Community Hall, 1 Example Way',
  drop_off_hours = 'Weekdays 9–5 · Sat Dec 14 to 5pm'
where id = '00000000-0000-4000-a000-000000002026';
