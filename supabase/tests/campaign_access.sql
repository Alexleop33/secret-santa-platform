-- The drive's dates and contact line are public; its drop-off address is
-- not; only the admin can change anything. Three callers, both directions.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

-- The campaign row is created by the migration itself, so it is always
-- present; its id is fixed. Its cap may have been edited on this database
-- already (the seed, or someone using Drive settings), so remember what it
-- is now rather than assuming the default.
create temporary table cap_before as
  select sponsor_cap from campaigns
  where id = '00000000-0000-4000-a000-000000002026';

-- Anonymous: the public view, nothing else.
set local role anon;

select is(
  (select count(*) from public_campaign),
  1::bigint,
  'anon can read the public campaign view'
);

select is(
  (select count(*) from campaigns),
  0::bigint,
  'anon cannot read the campaigns table'
);

select hasnt_column(
  'public', 'public_campaign', 'drop_off_address',
  'the public view has no drop-off address column'
);

select hasnt_column(
  'public', 'public_campaign', 'drop_off_hours',
  'the public view has no drop-off hours column'
);

reset role;

-- A signed-in non-admin: same as anon.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from campaigns),
  0::bigint,
  'a non-admin cannot read the campaigns table'
);

update campaigns set sponsor_cap = 5;
reset role;

select is(
  (select sponsor_cap from campaigns where id = '00000000-0000-4000-a000-000000002026'),
  (select sponsor_cap from cap_before),
  'a non-admin cannot change the sponsor cap'
);

-- The admin: reads and updates.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

update campaigns
set sponsor_cap = 5, drop_off_address = 'Test Hall'
where id = '00000000-0000-4000-a000-000000002026';
reset role;

select is(
  (select sponsor_cap from campaigns where id = '00000000-0000-4000-a000-000000002026'),
  5,
  'the admin can change the sponsor cap'
);

select is(
  (select drop_off_address from campaigns where id = '00000000-0000-4000-a000-000000002026'),
  'Test Hall',
  'the admin can set the drop-off address'
);

select * from finish();
rollback;
