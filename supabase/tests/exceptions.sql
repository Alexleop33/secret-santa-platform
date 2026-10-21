-- The admin's two exception actions: record an offline sponsor, and
-- release a claim on a sponsor's behalf. Only the admin, and the same
-- one-active-claim rule as everyone else.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000011', 'donor-a@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (id, ref_code, summary, status, referred_on, consent_wish_list) values
  ('00000000-0000-4000-9000-000000000301', '#x1', 'live one', 'live', now(), true),
  ('00000000-0000-4000-9000-000000000302', '#x2', 'live two', 'live', now(), true);
update campaigns set status = 'open', claims_close = current_date + 30
where id = '00000000-0000-4000-a000-000000002026';

-- A donor cannot record an offline sponsor or release on someone's behalf.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  $$ select admin_manual_claim('00000000-0000-4000-9000-000000000301', 'phoned in') $$,
  '42501', null, 'a donor cannot record an offline sponsor'
);
create temporary table donor_claim as
  select claim_household('00000000-0000-4000-9000-000000000302') as id;
grant select on donor_claim to authenticated;
reset role;

-- The admin records an offline match on #x1.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
create temporary table offline as
  select admin_manual_claim('00000000-0000-4000-9000-000000000301', 'Mrs K, phoned Tuesday') as id;

select is((select count(*) from public_households where ref_code = '#x1'), 0::bigint, 'an offline-sponsored household leaves the public list');
select is((select sponsor_label from claims_with_sponsor where ref_code = '#x1'), 'Mrs K, phoned Tuesday', 'the label is kept for the admin');
select is((select sponsor_email from claims_with_sponsor where ref_code = '#x1'), null, 'an offline sponsor has no email');
select throws_ok(
  $$ select admin_manual_claim('00000000-0000-4000-9000-000000000301', 'again') $$,
  'P0002', 'already_claimed', 'a second offline match on the same household is refused'
);

-- The admin releases the donor's claim on #x2 (a sponsor who went silent).
select lives_ok(
  $$ select admin_release_claim((select id from donor_claim)) $$,
  'the admin can release a claim on a sponsor''s behalf'
);
select is((select count(*) from public_households where ref_code = '#x2'), 1::bigint, 'the released household is public again');
reset role;

-- The donor cannot release the offline claim.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
select throws_ok(
  format('select admin_release_claim(%L)', (select id from offline)),
  '42501', null, 'a donor cannot use the admin release'
);
reset role;

select * from finish();
rollback;
