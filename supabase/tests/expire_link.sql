-- "Expire now": only the admin can close a link early; once closed, the
-- form refuses it the same way as a link whose date has passed, the row
-- says who closed it and when, and the activity log has a line.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'someone@example.test');
insert into profiles (id, role)
values ('00000000-0000-4000-8000-000000000001', 'admin');
update campaigns set status = 'open' where id = '00000000-0000-4000-a000-000000002026';

-- The admin makes a link that is open for 30 days and 5 uses.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- Keep the id and token in session settings rather than a temp table: the
-- test switches roles below, and a temp table made as one role can't be
-- read as another.
select set_config('test.link_id', id::text, true), set_config('test.token', token, true)
from create_referral_link(5, 30);

select is(
  referral_link_status(current_setting('test.token')),
  'valid',
  'before: the link is valid'
);

-- A signed-in non-admin cannot close it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  format($$ select expire_referral_link(%L) $$, current_setting('test.link_id')::uuid),
  '42501',
  null,
  'a non-admin cannot expire a link'
);

-- Anonymous cannot even call the function.
set local role anon;
select throws_ok(
  format($$ select expire_referral_link(%L) $$, current_setting('test.link_id')::uuid),
  '42501',
  null,
  'anon cannot call expire_referral_link'
);

-- The admin closes it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  format($$ select expire_referral_link(%L) $$, current_setting('test.link_id')::uuid),
  'the admin can expire a usable link'
);

select is(
  referral_link_status(current_setting('test.token')),
  'expired',
  'after: the form sees the link as expired'
);

-- The submission function refuses it before looking at anything else.
set local role anon;
select throws_ok(
  format($$ select submit_referral(%L, '{}'::jsonb) $$, current_setting('test.token')),
  'P0001', 'This link has expired.',
  'a family cannot submit through a closed link'
);

-- The row says who and when, and the log has a line.
reset role;
select ok(
  (select closed_at is not null
     and closed_by = '00000000-0000-4000-8000-000000000001'
     and expires_at < now()
   from referral_links where id = current_setting('test.link_id')::uuid),
  'the link records who closed it and when'
);
select is(
  (select count(*) from activity where action = 'referral_link_closed' and actor_role = 'admin'),
  1::bigint,
  'closing a link writes one activity line'
);

-- Closing it again is refused, so the log cannot be padded.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(
  format($$ select expire_referral_link(%L) $$, current_setting('test.link_id')::uuid),
  'P0001', 'That link has already expired.',
  'a closed link cannot be closed twice'
);

select * from finish();
rollback;
