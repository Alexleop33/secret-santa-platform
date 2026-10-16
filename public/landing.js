// The landing page (D1). Two public views feed it: public_campaign for
// the names and dates, public_counts for the two numbers. Both are
// readable without signing in; neither carries anything about any
// household.
import { supabase } from "./auth.js";
import { formatDate } from "./console.js";

const [{ data: campaigns }, { data: counts }] = await Promise.all([
  supabase.from("public_campaign").select("*").limit(1),
  supabase.from("public_counts").select("*").limit(1),
]);
const campaign = campaigns?.[0];
const count = counts?.[0];

function daysUntil(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

if (campaign) {
  document.getElementById("org-line").textContent = `${campaign.organization_name} · ${campaign.year} gift drive`;
  document.getElementById("hero-eyebrow").textContent = `${campaign.organization_name} · ${campaign.year} gift drive`;
  document.getElementById("deadline-line").textContent =
    `Claim a family by ${formatDate(campaign.claims_close)} · unwrapped gifts due ${formatDate(campaign.gifts_due)}`;
  document.getElementById("step-dropoff").textContent =
    `Bring everything unwrapped to the drop-off point by ${formatDate(campaign.gifts_due)}. The address is in your confirmation.`;
  document.getElementById("footer-contact").textContent =
    `Questions? ${campaign.coordinator_name} · ${campaign.contact_phone} · ${campaign.contact_email}`;
  document.getElementById("count-days").textContent = `${daysUntil(campaign.gifts_due)} days until the drop-off deadline`;
}

// The admin can switch the public count off; then the card says less.
if (count && count.need_sponsor != null) {
  const need = Number(count.need_sponsor);
  const sponsored = Number(count.sponsored ?? 0);
  const total = need + sponsored;
  document.getElementById("count-num").textContent = String(need);
  document.getElementById("count-label").textContent = need === 1 ? "family still needs a sponsor" : "families still need a sponsor";
  document.getElementById("count-bar").style.width = total ? `${Math.round((sponsored / total) * 100)}%` : "0%";
  document.getElementById("count-sub").textContent = `${sponsored} of ${total} families sponsored so far`;
} else {
  document.getElementById("count-num").textContent = "";
  document.getElementById("count-label").textContent = "Families are waiting for a sponsor";
  document.getElementById("count-sub").textContent = "";
}
if (count) {
  const review = Number(count.awaiting_review);
  document.getElementById("count-review").textContent = review
    ? `${review} more referral${review === 1 ? "" : "s"} awaiting review`
    : "";
}
