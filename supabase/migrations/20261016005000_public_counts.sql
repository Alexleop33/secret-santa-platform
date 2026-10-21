-- The two numbers the landing page may show before anyone signs in: how
-- many households still need a sponsor, and how many are sponsored so far.
-- A view, like public_campaign, so anonymous visitors get exactly these
-- numbers and nothing else about any household. Both are null when the
-- admin switches "show the remaining count publicly" off.
--
-- Sponsorship does not exist yet; sponsored is 0 until the claims slice
-- replaces this view with one that counts claims.

create view public_counts
with (security_barrier = true) as
  select
    c.id as campaign_id,
    case when c.show_public_count then
      (select count(*) from households h where h.campaign_id = c.id and h.status = 'live')
    end as need_sponsor,
    case when c.show_public_count then 0::bigint end as sponsored,
    (select count(*) from households h where h.campaign_id = c.id and h.status = 'pending_review')
      as awaiting_review
  from campaigns c;

grant select on public_counts to anon, authenticated;
