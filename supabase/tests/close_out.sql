-- Closing the drive empties the public list and refuses claims; the purge
-- refuses to run until the drive is closed, then deletes exactly the
-- contact rows and logs it; no API role can call the purge.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000011', 'donor-a@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000401', '#z1', 'live', 'live', now(), true);
insert into household_contacts (household_id, email) values
  ('00000000-0000-4000-9000-000000000401', 'z1@example.test');

update campaigns set status = 'open', claims_close = current_date + 30
where id = '00000000-0000-4000-a000-000000002026';

-- The purge refuses while the drive is open, and API roles cannot call it.
select throws_ok(
  $$ select purge_retained_contacts('00000000-0000-4000-a000-000000002026') $$,
  'P0001', 'Close the drive before purging its contact rows.',
  'the purge refuses to run on an open drive'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select purge_retained_contacts('00000000-0000-4000-a000-000000002026') $$,
  '42501', null,
  'even the admin cannot call the purge through the API'
);
select is((select count(*) from season_totals), 1::bigint, 'the admin can read the season totals');

-- The admin closes the drive.
update campaigns set status = 'closed' where id = '00000000-0000-4000-a000-000000002026';
reset role;

set local role anon;
select is((select count(*) from public_households), 0::bigint, 'a closed drive has an empty public list');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$ select claim_household('00000000-0000-4000-9000-000000000401') $$,
  'P0001', 'Claims have closed for this season.',
  'a closed drive refuses claims'
);
select is((select count(*) from season_totals), 0::bigint, 'a donor reads no season totals');
reset role;

-- The purge, as the database owner (what the GitHub Action connects as).
create temporary table purged as
  select purge_retained_contacts('00000000-0000-4000-a000-000000002026') as n;

select ok((select n from purged) >= 1, 'the purge deletes the contact rows');
select is(
  (select count(*) from household_contacts hc join households h on h.id = hc.household_id
   where h.campaign_id = '00000000-0000-4000-a000-000000002026'),
  0::bigint,
  'no contact rows remain for the campaign'
);
select is(
  (select count(*) from activity where action = 'contacts_purged' and campaign_id = '00000000-0000-4000-a000-000000002026'),
  1::bigint,
  'the purge is logged'
);

select * from finish();
rollback;
