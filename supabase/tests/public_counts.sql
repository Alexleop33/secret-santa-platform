-- Anyone can read the public counts; they are right; and they go blank
-- when the admin turns the toggle off. Nothing about a household leaks.
begin;
select plan(5);

insert into households (ref_code, summary, status, referred_on) values
  ('#t1', 'test household, pending', 'pending_review', now()),
  ('#t2', 'test household, live', 'live', now()),
  ('#t3', 'test household, also live', 'live', now()),
  ('#t4', 'test household, rejected', 'rejected', now());

-- Remember what the sandbox already holds, so the numbers below are
-- differences, not absolutes.
create temporary table before as
  select
    (select count(*) from households where status = 'live') as live,
    (select count(*) from households where status = 'pending_review') as pending;
grant select on before to anon;

set local role anon;

select is(
  (select count(*) from public_counts),
  1::bigint,
  'anon can read the public counts'
);

select is(
  (select need_sponsor from public_counts limit 1),
  (select live from before),
  'need_sponsor counts the live households'
);

select is(
  (select awaiting_review from public_counts limit 1),
  (select pending from before),
  'awaiting_review counts the pending households'
);

select hasnt_column(
  'public', 'public_counts', 'summary',
  'the counts view carries nothing about any household'
);

reset role;
update campaigns set show_public_count = false;
set local role anon;

select is(
  (select need_sponsor from public_counts limit 1),
  null,
  'with the toggle off, need_sponsor is blank'
);

reset role;
select * from finish();
rollback;
