-- The bootstrap admin is part of the platform: the seeded invite promotes
-- the bootstrap address on its first sign-in, and nobody else.
begin;
select plan(4);

-- The migration ran against this database, so either the invite is
-- pending or (if the address had an account here) it was promoted.
select ok(
  exists (select 1 from admin_invites where email = 'david@davidwelch.co')
  or exists (select 1 from profiles p join auth.users u on u.id = p.id
             where lower(u.email) = 'david@davidwelch.co' and p.role = 'admin'),
  'the bootstrap address is invited or already an admin'
);

-- Someone else signing in first gets nothing.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000021', 'first-stranger@example.test');
select is(
  (select count(*) from profiles where id = '00000000-0000-4000-8000-000000000021'),
  0::bigint,
  'a stranger who signs in first is not promoted'
);

-- The bootstrap address signing in is promoted, if its invite is still open.
delete from auth.users where lower(email) = 'david@davidwelch.co';
insert into admin_invites (email) values ('david@davidwelch.co')
on conflict (email) where used_at is null do nothing;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000022', 'David@DavidWelch.co');
select is(
  (select role from profiles where id = '00000000-0000-4000-8000-000000000022'),
  'admin',
  'the bootstrap address is promoted on its first sign-in, whatever the casing'
);
select isnt(
  (select used_at from admin_invites where email = 'david@davidwelch.co' and used_by = '00000000-0000-4000-8000-000000000022'),
  null,
  'the bootstrap invite is marked used'
);

select * from finish();
rollback;
