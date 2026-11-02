-- Epic #14 / Story #10 criterion 9: a sizes entry up to 80 characters must
-- reach the page in full. The old 40-char limit truncated mid-word
-- ("socks lar", "underwear medi" — see chore #13, a separate data-fix
-- task for the rows this already happened to).
--
-- Only widens the constraint — every existing row is already <= 40 chars,
-- so no backfill. identifying_text_problem() is a regex scan with no
-- length assumption, so it needs no change for the wider column.

alter table household_members
  drop constraint household_members_clothing_size_check,
  drop constraint household_members_shoe_size_check,
  add constraint household_members_clothing_size_check check (length(clothing_size) <= 80),
  add constraint household_members_shoe_size_check check (length(shoe_size) <= 80);
