-- Sandbox fixtures only. Never run this against the production project —
-- these are fake rows for testing the queue, not real referrals.
insert into households (ref_code, summary, status, referred_on) values
  ('#14', 'A family of four, two children, ages 6 and 9.', 'pending_review', '2026-10-01 09:00:00+00'),
  ('#7', 'A single parent with one toddler.', 'pending_review', '2026-10-05 14:30:00+00'),
  ('#22', 'Two adults, no children, first time referring.', 'pending_review', '2026-10-10 11:15:00+00');

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
