-- A visitor who hasn't signed in ("anon") must see no households and no
-- profiles. There is no policy granting anon anything, so RLS should return
-- zero rows — not an error, zero rows. This test proves that stays true.
begin;
select plan(3);

-- Fixtures, inserted as the superuser before we become anon.
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-000000000001', 'admin@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
insert into households (ref_code, summary, status, referred_on) values
  ('#t1', 'test household, pending', 'pending_review', now()),
  ('#t2', 'test household, live', 'live', now());

-- Become the anonymous role, exactly as a request with only the
-- publishable key would.
set local role anon;

select is(
  (select count(*) from households),
  0::bigint,
  'anon sees no households'
);

select is(
  (select count(*) from profiles),
  0::bigint,
  'anon sees no profiles'
);

-- An anon UPDATE is refused outright: anon has no UPDATE privilege on the
-- table at all (revoked in the review-queue migration), so it never gets
-- as far as a policy. An error, not a silent no-op.
select throws_ok(
  $$ update households set status = 'live' where ref_code = '#t1' $$,
  '42501',
  null,
  'anon cannot resolve a pending referral'
);
reset role;

select * from finish();
rollback;
