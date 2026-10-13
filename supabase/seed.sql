-- Sandbox fixtures only. Never run this against the production project —
-- these are fake rows for testing the queue, not real referrals.
insert into households (ref_code, summary, status, referred_on) values
  ('#14', 'A family of four, two children, ages 6 and 9.', 'pending_review', '2026-10-01 09:00:00+00'),
  ('#7', 'A single parent with one toddler.', 'pending_review', '2026-10-05 14:30:00+00'),
  ('#22', 'Two adults, no children, first time referring.', 'pending_review', '2026-10-10 11:15:00+00');
