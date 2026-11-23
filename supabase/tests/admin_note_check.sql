-- The soft stop on the coordinator's note (Epic #27, slice 27a, decided
-- with Alex 2026-11-22). Before saving her note, the queue page asks
-- identifying_text_problem() whether it holds a phone number, an email
-- address or a street address: the same check the referral form runs on a
-- family's words. If it does, the page asks her to confirm before saving.
-- These prove the check is there for a signed-in caller, and what it finds.
begin;
select plan(6);

select ok(
  has_function_privilege('authenticated', 'public.identifying_text_problem(text)', 'execute'),
  'a signed-in user can run the check the queue page calls'
);

select is(public.identifying_text_problem('call her at 555-010-1234'), 'a phone number', 'a phone number is found');
select is(public.identifying_text_problem('reach them at family@example.test'), 'an email address', 'an email address is found');
select is(public.identifying_text_problem('drop-off at 12 Example St'), 'a street address', 'a street address is found');

-- The mockup's own example note must not set off the box.
select is(
  public.identifying_text_problem($$Sizes confirmed by phone Nov 4.
Dec 2: sponsor dropped off 3 bags. Boy's snow boots still missing; sponsor is bringing them Friday.$$),
  null::text,
  'an ordinary note about sizes and drop-off passes'
);

select is(public.identifying_text_problem(''), null::text, 'an empty note passes');

select * from finish();
rollback;
