-- Only the admin can make a referral link, only the admin can see the
-- list, and the table holds a hash, never the token. Both directions.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');

-- The table has no column that could hold a plain token.
select hasnt_column(
  'public', 'referral_links', 'token',
  'referral_links stores no plain token column'
);

-- Anonymous: cannot call the function at all.
set local role anon;
select throws_ok(
  $$ select * from create_referral_link() $$,
  '42501',
  null,
  'anon cannot call create_referral_link'
);
select is(
  (select count(*) from referral_links),
  0::bigint,
  'anon sees no referral links'
);
reset role;

-- A signed-in non-admin: the function refuses, the table is empty to them.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select * from create_referral_link() $$,
  '42501',
  null,
  'a non-admin cannot create a referral link'
);
select is(
  (select count(*) from referral_links),
  0::bigint,
  'a non-admin sees no referral links'
);
reset role;

-- The admin: makes one, gets a 48-character token, and the row holds its hash.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

create temporary table made as select * from create_referral_link();

select is(
  (select length(token) from made),
  48,
  'the admin gets a 48-character token'
);

select is(
  (select count(*) from referral_links
   where token_hash = (select sha256(convert_to(token, 'UTF8')) from made)
     and used_at is null
     and expires_at > now() + interval '6 days'),
  1::bigint,
  'the row stores the SHA-256 of the token, unused, expiring in seven days'
);

select is(
  (select count(*) from referral_links where id = (select id from made)),
  1::bigint,
  'the admin can see the link in the list'
);

reset role;
select * from finish();
rollback;
