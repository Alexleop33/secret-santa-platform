// One family's story (D3), the claim step (D4, trimmed), and losing the
// race (D9). Reads from the public views, so anyone can get this far;
// claiming calls claim_household(), which insists on a signed-in donor and
// does every check itself.
import { supabase } from "./auth.js";
import { formatDate } from "./console.js";

const root = document.getElementById("story");
const householdId = new URLSearchParams(window.location.search).get("h") || "";

const ROLE_LABELS = {
  boy: "Boy", girl: "Girl", child: "Child", mom: "Mom", dad: "Dad",
  grandmother: "Grandmother", grandfather: "Grandfather", adult: "Adult",
};
const CHILD_ROLES = new Set(["boy", "girl", "child"]);

let campaign = null;
let household = null;
let members = [];
let items = [];
let session = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function personLabel(member) {
  const base = ROLE_LABELS[member.role] ?? member.role;
  return CHILD_ROLES.has(member.role) && member.age != null ? `${base}, ${member.age}` : base;
}

function renderPerson(member) {
  const card = el("div", "person");
  const heading = el("h3");
  heading.append(el("span", null, personLabel(member)));
  const sizes = el("span", "sizes");
  if (member.clothing_size) sizes.appendChild(el("span", "size", member.clothing_size));
  if (member.shoe_size) sizes.appendChild(el("span", "size", member.shoe_size));
  heading.appendChild(sizes);
  card.appendChild(heading);
  const own = items.filter((i) => i.member_id === member.id);
  const needs = own.filter((i) => i.kind === "need").map((i) => i.label);
  const loves = own.filter((i) => i.kind === "would_love").map((i) => i.label);
  if (needs.length) {
    const line = el("p");
    line.append(el("b", null, "Needs "), document.createTextNode(needs.join(", ")));
    card.appendChild(line);
  }
  if (loves.length) {
    const line = el("p");
    line.append(el("b", null, "Would love "), document.createTextNode(loves.join(", ")));
    card.appendChild(line);
  }
  return card;
}

function renderGone() {
  root.innerHTML = "";
  const card = el("div", "card");
  card.append(
    el("h2", null, "This family has been sponsored, or is no longer listed"),
    el("p", "muted", "Households come off the list the moment someone claims them. Head back to the list — released households return there."),
  );
  const back = el("a", "btn btn-primary", "Back to families");
  back.href = "/browse.html";
  card.appendChild(back);
  root.appendChild(card);
}

function renderStory() {
  root.innerHTML = "";

  const main = el("div", "stack");
  const status = el("p");
  status.append(
    el("span", "pill pill-live", "Needs a sponsor"),
    el("span", "muted small", ` Family ${household.ref_code} · referred ${formatDate(household.referred_on.slice(0, 10))}${campaign ? ` through ${campaign.organization_name}` : ""}`),
  );
  main.append(status, el("h1", null, household.summary));
  if (household.story) {
    main.appendChild(el("div", "story-box", household.story));
  } else {
    main.appendChild(el("p", "notice", "The family chose to keep their story private. The coordinator has read it."));
  }
  const needsHead = el("div", "pick-top");
  needsHead.append(el("h2", null, "What this household needs"), el("span", "muted small", `${items.length} item${items.length === 1 ? "" : "s"} across ${members.length} ${members.length === 1 ? "person" : "people"}`));
  main.appendChild(needsHead);
  const people = el("div", "people");
  for (const member of members) people.appendChild(renderPerson(member));
  main.appendChild(people);

  const side = el("div", "stack");
  side.appendChild(renderSponsorPanel());
  const notSure = el("div", "card card-tinted small");
  notSure.append(
    el("p", null, "Not sure yet? Families stay listed until someone claims them."),
    el("p", "muted", campaign ? `Questions go to ${campaign.coordinator_name} · ${campaign.contact_phone}.` : ""),
  );
  side.appendChild(notSure);

  root.append(main, side);
}

function renderSponsorPanel() {
  const card = el("div", "card");
  card.appendChild(el("h2", null, "Sponsor this family"));
  const steps = el("ol", "sponsor-steps");
  steps.append(
    el("li", null, "Drop-off details come with your confirmation."),
    el("li", null, "Buy what you can from the wish list — you don't have to cover everything."),
    el("li", null, campaign ? `Drop the gifts off unwrapped by ${formatDate(campaign.gifts_due)}.` : "Drop the gifts off unwrapped by the deadline."),
  );
  card.appendChild(steps);
  const button = el("button", "btn btn-primary btn-block", "Sponsor this family");
  button.type = "button";
  button.onclick = startClaim;
  card.appendChild(button);
  card.appendChild(el("p", "muted small", "No names, phone numbers or addresses appear on this page, or anywhere on this site. Gifts go to a central drop-off; the coordinator sorts them by household."));
  return card;
}

// ---------- Claiming ----------

function startClaim() {
  if (!session) {
    // Come back here after signing in. auth.js reads this on the next page
    // that has a session and sends the browser along.
    sessionStorage.setItem("next", window.location.pathname + window.location.search);
    window.location.href = "/signin.html";
    return;
  }
  renderConfirm();
}

function renderConfirm() {
  const side = root.lastElementChild;
  side.innerHTML = "";
  const card = el("div", "card");
  card.append(el("p", "eyebrow", "You are sponsoring"), el("h2", null, `Family ${household.ref_code}`), el("p", "muted", household.summary));
  const facts = el("ul", "row-list");
  const fact = (label, value) => {
    const li = el("li");
    li.append(el("span", "muted", label), el("span", "actions", value));
    return li;
  };
  facts.append(
    fact("Wish-list items", `${items.length} across ${members.length} ${members.length === 1 ? "person" : "people"}`),
    fact("Gifts due", campaign ? formatDate(campaign.gifts_due) : "—"),
    fact("Drop-off", "in your confirmation"),
  );
  card.appendChild(facts);

  const commit = el("label", "check");
  const box = document.createElement("input");
  box.type = "checkbox";
  commit.append(box, el("span", null, campaign ? `I'll deliver unwrapped gifts to the drop-off point by ${formatDate(campaign.gifts_due)}, or let the coordinator know if my plans change.` : "I'll deliver unwrapped gifts to the drop-off point by the deadline, or let the coordinator know if my plans change."));
  card.appendChild(commit);

  card.appendChild(el("p", "notice notice-amber small", "This family comes off the public list the moment you confirm, so no one else buys the same gifts."));

  const actions = el("div", "form-actions");
  const confirm = el("button", "btn btn-primary", "Confirm sponsorship");
  confirm.type = "button";
  confirm.disabled = true;
  box.onchange = () => {
    confirm.disabled = !box.checked;
  };
  const cancel = el("button", "btn btn-outline", "Cancel");
  cancel.type = "button";
  cancel.onclick = renderStory;
  const status = el("span", "status-line");
  actions.append(confirm, cancel, status);
  card.appendChild(actions);

  confirm.onclick = async () => {
    confirm.disabled = true;
    status.textContent = "Confirming…";
    const { data, error } = await supabase.rpc("claim_household", { p_household_id: household.id });
    if (error) {
      if (error.message === "already_claimed") {
        renderLostRace();
        return;
      }
      confirm.disabled = false;
      status.textContent = "";
      card.appendChild(el("p", "notice notice-red", error.message));
      return;
    }
    window.location.href = `/confirmed.html?c=${encodeURIComponent(data)}`;
  };

  side.appendChild(card);
}

function renderLostRace() {
  const pill = root.querySelector(".pill");
  if (pill) {
    pill.className = "pill pill-sponsored";
    pill.textContent = "Sponsored";
  }
  const side = root.lastElementChild;
  side.innerHTML = "";
  const card = el("div", "card");
  card.append(
    el("p", "eyebrow", "Just missed it"),
    el("h2", null, `Family ${household.ref_code} was just sponsored`),
    el("p", null, "Someone claimed this household a moment before you did — nothing was committed on your side."),
  );
  const back = el("a", "btn btn-primary btn-block", "Back to families");
  back.href = "/browse.html";
  card.appendChild(back);
  side.appendChild(card);
}

// ---------- Start ----------

async function start() {
  if (!householdId) {
    renderGone();
    return;
  }
  const [{ data: sessionData }, { data: campaigns }, { data: rows }, { data: memberRows }, { data: itemRows }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("public_campaign").select("*").limit(1),
    supabase.from("public_households").select("*").eq("id", householdId).limit(1),
    supabase.from("public_household_members").select("*").eq("household_id", householdId).order("position"),
    supabase.from("public_wish_items").select("*").eq("household_id", householdId).order("position"),
  ]);
  session = sessionData.session;
  campaign = campaigns?.[0] ?? null;
  if (campaign) document.getElementById("org-line").textContent = `${campaign.organization_name} · ${campaign.year} gift drive`;
  household = rows?.[0] ?? null;
  if (!household) {
    renderGone();
    return;
  }
  members = memberRows ?? [];
  items = itemRows ?? [];
  renderStory();
}

await start();
