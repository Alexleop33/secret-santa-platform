// Browse families (D2, and D10 on a phone). Everything on this page comes
// from the three public views: live, unclaimed households, their people
// and their items. Nothing needs a sign-in to read. The Sponsor button
// goes to the story page, where claiming does.
//
// Filters run in the browser over the rows already fetched: a few hundred
// at most, and no round-trip per click.
import { supabase } from "./auth.js";

const list = document.getElementById("families");
const sub = document.getElementById("browse-sub");
const foot = document.getElementById("browse-foot");
const filterSize = document.getElementById("filter-size");
const filterAges = document.getElementById("filter-ages");

let households = [];

const CHILD_ROLES = new Set(["boy", "girl", "child"]);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function passesFilters(h) {
  const size = h.members.length;
  const sizeWanted = filterSize.value;
  if (sizeWanted === "1-2" && size > 2) return false;
  if (sizeWanted === "3-4" && (size < 3 || size > 4)) return false;
  if (sizeWanted === "5+" && size < 5) return false;

  const ages = h.members.filter((m) => CHILD_ROLES.has(m.role) && m.age != null).map((m) => m.age);
  const agesWanted = filterAges.value;
  if (agesWanted === "under5" && !ages.some((a) => a < 5)) return false;
  if (agesWanted === "5-12" && !ages.some((a) => a >= 5 && a <= 12)) return false;
  if (agesWanted === "teens" && !ages.some((a) => a >= 13 && a <= 19)) return false;
  if (agesWanted === "adults" && ages.length > 0) return false;
  return true;
}

function render() {
  const shown = households.filter(passesFilters);
  list.innerHTML = "";
  if (!shown.length) {
    const card = el("div", "card");
    card.appendChild(el("p", "muted", households.length ? "No families match those filters." : "Every family on the list has been claimed. Check back — released households return here."));
    list.appendChild(card);
    return;
  }

  for (const h of shown) {
    const row = el("article", "family-row");
    const icon = el("div", "family-icon", "⌂");
    const body = el("div", "family-body");
    const title = el("h2");
    title.append(el("span", null, h.summary), el("span", "muted small family-ref", ` Family ${h.ref_code}`));
    body.appendChild(title);
    body.appendChild(el("p", "muted small", h.story ? "The family shared a few words about this year." : "Referred through a local family support program."));
    const tags = el("div", "tags");
    for (const item of h.items.slice(0, 3)) tags.appendChild(el("span", "tag", item.label));
    if (h.items.length > 3) tags.appendChild(el("span", "muted small", `+${h.items.length - 3} more`));
    body.appendChild(tags);
    const actions = el("div", "family-actions");
    const view = el("a", "family-view", "View story →");
    view.href = `/story.html?h=${encodeURIComponent(h.id)}`;
    const sponsor = el("a", "btn btn-primary", "Sponsor");
    sponsor.href = `/story.html?h=${encodeURIComponent(h.id)}`;
    actions.append(view, sponsor);
    row.append(icon, body, actions);
    list.appendChild(row);
  }
}

async function load() {
  const [{ data: campaigns }, { data: counts }, { data: rows, error }, { data: members }, { data: items }] = await Promise.all([
    supabase.from("public_campaign").select("*").limit(1),
    supabase.from("public_counts").select("*").limit(1),
    supabase.from("public_households").select("*").order("referred_on", { ascending: true }),
    supabase.from("public_household_members").select("*").order("position", { ascending: true }),
    supabase.from("public_wish_items").select("*").order("position", { ascending: true }),
  ]);

  if (error) {
    list.innerHTML = "";
    list.appendChild(el("p", "notice notice-red", `Couldn't load the list: ${error.message}`));
    return;
  }

  const campaign = campaigns?.[0];
  if (campaign) document.getElementById("org-line").textContent = `${campaign.organization_name} · ${campaign.year} gift drive`;

  // Items are shown in the order the family listed people, then items, so
  // a child's needs come before a parent's grocery card.
  households = rows.map((h) => {
    const mine = (members ?? []).filter((m) => m.household_id === h.id);
    const order = new Map(mine.map((m) => [m.id, m.position]));
    const own = (items ?? [])
      .filter((i) => i.household_id === h.id)
      .sort((a, b) => (order.get(a.member_id) ?? 99) - (order.get(b.member_id) ?? 99) || a.position - b.position);
    return { ...h, members: mine, items: own };
  });

  const count = counts?.[0];
  const need = households.length;
  sub.textContent = count?.sponsored != null
    ? `${need} need a sponsor · ${count.sponsored} already sponsored`
    : `${need} need a sponsor`;
  foot.textContent = count?.sponsored
    ? `${count.sponsored} famil${Number(count.sponsored) === 1 ? "y has" : "ies have"} already been sponsored this season. Once a household is claimed it comes straight off this list, so no one buys the same gifts twice.`
    : "Once a household is claimed it comes straight off this list, so no one buys the same gifts twice.";

  render();
}

filterSize.onchange = render;
filterAges.onchange = render;
await load();
