// My families (D6, D7 without the thank-you, D8): shop, track, hand over,
// or back out. Everything here is the donor's own, read through the
// my_* views and changed through functions that check the claim is theirs.
import { supabase } from "./auth.js";
import { formatDate } from "./console.js";

const root = document.getElementById("mine");
const list = document.getElementById("claims");
const sub = document.getElementById("mine-sub");
const capNotice = document.getElementById("cap");

const ROLE_LABELS = { boy: "Boy", girl: "Girl", child: "Child", mom: "Mom", dad: "Dad", grandmother: "Grandmother", grandfather: "Grandfather", adult: "Adult" };
const CHILD_ROLES = new Set(["boy", "girl", "child"]);

let claims = [];
let members = [];
let items = [];
let campaign = null;
let drop = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function personLabel(m) {
  const base = ROLE_LABELS[m.role] ?? m.role;
  return CHILD_ROLES.has(m.role) && m.age != null ? `${base}, ${m.age}` : base;
}

function daysUntil(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function renderClaim(claim) {
  const card = el("article", "card claim-card");
  const own = items.filter((i) => i.household_id === claim.household_id);
  const bought = own.filter((i) => i.bought_at).length;
  const delivered = claim.status === "delivered";

  const head = el("div", "pick-top");
  const title = el("div");
  title.append(el("h2", null, claim.summary), el("p", "muted small", `Family ${claim.ref_code} · claimed ${formatDate(claim.claimed_at.slice(0, 10))}`));
  const pills = el("div", "tags");
  pills.appendChild(el("span", delivered ? "pill pill-delivered" : "pill pill-sponsored", delivered ? "Gifts delivered" : "Sponsored"));
  head.append(title, pills);
  card.appendChild(head);

  const cols = el("div", "two-col");

  const left = el("div");
  left.appendChild(el("p", "eyebrow", "Drop-off"));
  const facts = el("ul", "row-list");
  const fact = (label, value) => {
    const li = el("li");
    li.append(el("span", "muted", label), el("span", "actions", value));
    return li;
  };
  facts.append(
    fact("Drop off by", drop ? formatDate(drop.gifts_due) : "—"),
    fact("Where", drop?.drop_off_address ?? "—"),
    fact("Hours", drop?.drop_off_hours ?? "—"),
  );
  left.appendChild(facts);
  const progress = el("div", "progress");
  const bar = el("span");
  bar.style.width = own.length ? `${Math.round((bought / own.length) * 100)}%` : "0%";
  progress.appendChild(bar);
  left.append(progress, el("p", "muted small", `${bought} of ${own.length} items bought`));

  const right = el("div");
  right.appendChild(el("p", "eyebrow", "Wish list"));
  const checklist = el("ul", "checklist");
  for (const m of members.filter((x) => x.household_id === claim.household_id)) {
    for (const i of own.filter((x) => x.member_id === m.id)) {
      const li = el("li", i.bought_at ? "done" : "");
      const label = el("label", "check");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = Boolean(i.bought_at);
      box.disabled = delivered;
      box.onchange = async () => {
        box.disabled = true;
        const { error } = await supabase.rpc("set_item_bought", { p_item_id: i.id, p_bought: box.checked });
        if (error) {
          box.checked = !box.checked;
          card.prepend(el("p", "notice notice-red", error.message));
        }
        await load();
      };
      label.append(box, el("span", null, `${personLabel(m)} — ${i.label}`));
      li.appendChild(label);
      checklist.appendChild(li);
    }
  }
  right.appendChild(checklist);
  cols.append(left, right);
  card.appendChild(cols);

  const actions = el("div", "form-actions claim-actions");
  if (delivered) {
    actions.appendChild(el("p", "notice notice-green", "Gifts marked delivered — thank you."));
  } else {
    const deliver = el("button", "btn btn-green", "Mark gifts delivered");
    deliver.type = "button";
    deliver.onclick = async () => {
      deliver.disabled = true;
      const { error } = await supabase.rpc("mark_delivered", { p_claim_id: claim.id });
      if (error) card.prepend(el("p", "notice notice-red", error.message));
      await load();
    };
    const print = el("button", "btn btn-outline", "Print the wish list");
    print.type = "button";
    print.onclick = () => window.print();
    const release = el("button", "btn btn-danger", "I can no longer sponsor");
    release.type = "button";
    release.onclick = () => renderRelease(card, claim);
    actions.append(deliver, print, el("span", "spacer"), release);
  }
  card.appendChild(actions);
  return card;
}

// D8, inline rather than a modal: consequences first, time pressure,
// safe default on the left, release in red.
function renderRelease(card, claim) {
  const box = el("div", "card card-tinted release-box");
  box.append(
    el("h3", null, `Release Family ${claim.ref_code}?`),
    el("p", null, "It goes straight back on the public list and the coordinator is notified so they can watch it."),
  );
  if (campaign) {
    const days = daysUntil(campaign.gifts_due);
    box.appendChild(el("p", "notice notice-amber small", `${days} days left before the drop-off deadline — the earlier you release, the more likely someone else picks it up.`));
  }
  const actions = el("div", "form-actions");
  const keep = el("button", "btn btn-outline", "Keep sponsoring");
  keep.type = "button";
  keep.onclick = () => box.remove();
  const go = el("button", "btn btn-danger", "Release family");
  go.type = "button";
  go.onclick = async () => {
    go.disabled = true;
    const { error } = await supabase.rpc("release_claim", { p_claim_id: claim.id });
    if (error) box.prepend(el("p", "notice notice-red", error.message));
    await load();
  };
  actions.append(keep, go);
  box.appendChild(actions);
  card.appendChild(box);
}

function render() {
  list.innerHTML = "";
  const active = claims.filter((c) => c.status !== "released");
  const days = campaign ? daysUntil(campaign.gifts_due) : null;
  sub.textContent = `${active.length} sponsored${days != null ? ` · ${days} days until drop-off` : ""}`;

  if (!active.length) {
    const card = el("div", "card");
    card.append(el("h2", null, "You haven't sponsored a family yet"), el("p", "muted", "Pick one from the list. It comes off the list the moment you confirm."));
    const go = el("a", "btn btn-primary", "Browse families");
    go.href = "/browse.html";
    card.appendChild(go);
    list.appendChild(card);
  }
  for (const claim of active) list.appendChild(renderClaim(claim));

  if (campaign) {
    const left = campaign.sponsor_cap - active.length;
    capNotice.classList.remove("hidden");
    capNotice.innerHTML = "";
    const text = el("span");
    text.append(
      el("strong", null, left > 0 ? `You can sponsor ${left} more household${left === 1 ? "" : "s"}` : "You've reached the limit for this season"),
      el("br"),
      el("span", "muted small", `The coordinator caps sponsors at ${campaign.sponsor_cap} so more people can take part.`),
    );
    capNotice.appendChild(text);
  }
}

async function load() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    root.innerHTML = "";
    const card = el("div", "card auth-card");
    card.appendChild(el("p", null, "Sign in to see the families you sponsor."));
    const link = el("a", "btn btn-primary", "Sign in");
    link.href = "/signin.html";
    card.appendChild(link);
    root.appendChild(card);
    return;
  }

  const [{ data: campaigns }, { data: claimRows, error }, { data: memberRows }, { data: itemRows }, { data: details }] = await Promise.all([
    supabase.from("public_campaign").select("*").limit(1),
    supabase.from("my_claims").select("*").order("claimed_at", { ascending: false }),
    supabase.from("my_household_members").select("*").order("position"),
    supabase.from("my_wish_items").select("*").order("position"),
    supabase.rpc("drop_off_details"),
  ]);
  if (error) {
    list.innerHTML = "";
    list.appendChild(el("p", "notice notice-red", error.message));
    return;
  }
  campaign = campaigns?.[0] ?? null;
  claims = claimRows ?? [];
  members = memberRows ?? [];
  items = itemRows ?? [];
  drop = Array.isArray(details) ? details[0] : details;
  render();
}

await load();
