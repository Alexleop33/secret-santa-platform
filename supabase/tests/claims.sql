-- Sponsoring, both directions: a donor can claim a live household once,
-- loses the race if someone else got there first, is held to the cap and
-- the claims-close date, sees only their own claims, and can tick items,
-- deliver and release. Anonymous callers can do none of it.
begin;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000011', 'donor-a@example.test'),
  ('00000000-0000-4000-8000-000000000012', 'donor-b@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000201', '#c1', 'live one', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000202', '#c2', 'live two', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000203', '#c3', 'live three', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000204', '#c4', 'pending', 'pending_review', now(), true);
insert into household_members (id, household_id, position, role, age) values
  ('00000000-0000-4000-9100-000000000201', '00000000-0000-4000-9000-000000000201', 1, 'boy', 7);
insert into wish_items (id, household_id, member_id, kind, label, position) values
  ('00000000-0000-4000-9200-000000000201', '00000000-0000-4000-9000-000000000201', '00000000-0000-4000-9100-000000000201', 'need', 'Coat', 1);

update campaigns set sponsor_cap = 2, claims_close = current_date + 30, status = 'open'
where id = '00000000-0000-4000-a000-000000002026';

-- ---------- anonymous ----------
set local role anon;
select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000201') $$,
  '42501', null,
  'anon cannot claim'
);
reset role;

-- ---------- donor A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);

create temporary table claim_a as
  select claim_household('00000000-0000-4000-9000-000000000201') as id;

select is((select count(*) from my_claims where ref_code = '#c1'), 1::bigint, 'donor A sees the claim in my_claims');
select is((select status from my_claims where ref_code = '#c1'), 'claimed', 'the claim starts as claimed');
select is((select count(*) from public_households where ref_code = '#c1'), 0::bigint, 'a claimed household leaves the public list');
select is((select role from profiles where id = '00000000-0000-4000-8000-000000000011'), 'donor', 'the first claim creates a donor profile row');
select is((select count(*) from my_wish_items where household_id = '00000000-0000-4000-9000-000000000201'), 1::bigint, 'donor A can read the items of a claimed household');

select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000204') $$,
  'P0001', 'This household is not available to sponsor.',
  'a pending household cannot be claimed'
);

-- Tick an item, see the drop-off details.
select lives_ok(
  $$ select set_item_bought('00000000-0000-4000-9200-000000000201', true) $$,
  'donor A can tick an item on a claimed household'
);
select isnt((select bought_at from my_wish_items where id = '00000000-0000-4000-9200-000000000201'), null, 'the tick is stored');
select is((select count(*) from drop_off_details()), 1::bigint, 'a claimant can read the drop-off details');

-- The cap: a second claim is fine, a third is not (cap 2).
select lives_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000202') $$,
  'a second claim within the cap is allowed'
);
select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000203') $$,
  'P0001', 'You have reached the limit of 2 households per sponsor.',
  'a claim beyond the cap is refused'
);
reset role;

-- ---------- donor B ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}', true);

select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000201') $$,
  'P0002', 'already_claimed',
  'donor B loses the race for a claimed household'
);
select is((select count(*) from my_claims), 0::bigint, 'donor B sees none of donor A''s claims');
select throws_ok(
  $$ select set_item_bought('00000000-0000-4000-9200-000000000201', true) $$,
  '42501', null,
  'donor B cannot tick an item on donor A''s household'
);
select throws_ok(
  format('select release_claim(%L)', (select id from claim_a)),
  '42501', null,
  'donor B cannot release donor A''s claim'
);
select is((select count(*) from drop_off_details()), 0::bigint, 'without a claim there are no drop-off details');
reset role;

-- ---------- donor A again: deliver one, release the other ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);

select lives_ok(
  $$ select mark_delivered((select id from claim_a)) $$,
  'donor A can call mark_delivered on their own claim'
);
select is((select status from my_claims where ref_code = '#c1'), 'delivered', 'the claim is now delivered');
select isnt((select delivered_at from my_claims where ref_code = '#c1'), null, 'delivered_at was stamped by the trigger');

select lives_ok(
  $$ select release_claim((select id from my_claims where ref_code = '#c2')) $$,
  'donor A can release their other claim'
);
select is((select count(*) from public_households where ref_code = '#c2'), 1::bigint, 'a released household returns to the public list');
reset role;
-- The tick on #c1 stays (delivered); a release would have cleared it. Prove
-- the clearing on #c2 by ticking first, then releasing, as the database.
insert into wish_items (id, household_id, member_id, kind, label, position, bought_at)
  select '00000000-0000-4000-9200-000000000202', '00000000-0000-4000-9000-000000000202', '00000000-0000-4000-9100-000000000201', 'need', 'Hat', 1, now();
insert into claims (household_id, donor_id) values ('00000000-0000-4000-9000-000000000202', '00000000-0000-4000-8000-000000000012');
update claims set status = 'released' where household_id = '00000000-0000-4000-9000-000000000202' and status = 'claimed';
select is((select bought_at from wish_items where id = '00000000-0000-4000-9200-000000000202'), null, 'releasing clears the previous sponsor''s ticks');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
reset role;

-- ---------- after claims close ----------
-- All four dates move together, or the dates-in-order constraint objects.
update campaigns
set nominations_open = current_date - 40, nominations_close = current_date - 10,
    claims_close = current_date - 1, gifts_due = current_date + 10
where id = '00000000-0000-4000-a000-000000002026';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000202') $$,
  'P0001', 'Claims have closed for this season.',
  'no claims after the claims-close date'
);
reset role;

-- ---------- the admin's view carries the sponsor's email ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select sponsor_email from claims_with_sponsor where ref_code = '#c1'),
  'donor-a@example.test',
  'the admin sees who sponsored a household'
);
reset role;

select * from finish();
rollback;
