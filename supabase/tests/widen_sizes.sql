-- Epic #14 criterion 9: a sizes entry up to 80 characters is accepted;
-- 81 is still refused. ref_code '#14' is a synthetic fixture id, not the
-- Epic number.
begin;
select plan(2);

insert into households (id, ref_code, summary, story, status, referred_on)
values ('00000000-0000-4000-9000-000000000901', '#901', 'widen-sizes fixture', 'x', 'pending_review', now());

select lives_ok(
  $$ insert into household_members (household_id, position, role, age, clothing_size, shoe_size)
     values ('00000000-0000-4000-9000-000000000901', 1, 'boy', 9, repeat('x', 80), repeat('x', 80)) $$,
  'an 80-character size is accepted'
);

select throws_ok(
  $$ insert into household_members (household_id, position, role, age, clothing_size, shoe_size)
     values ('00000000-0000-4000-9000-000000000901', 2, 'boy', 9, repeat('x', 81), '') $$,
  '23514', null, 'an 81-character size is still refused'
);

select * from finish();
rollback;
