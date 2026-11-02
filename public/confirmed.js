// Confirmed (D5): know exactly what to do next. The drop-off details come
// from drop_off_details(), which only answers a caller who holds a claim.
// There is no family contact card here and never will be: gifts go to the
// drop-off point, and the coordinator sorts them by household.
import { supabase } from "./auth.js";
import { formatDate } from "./console.js";

function img(file, className) {
  const node = document.createElement("img");
  node.src = `/assets/${file}`;
  node.alt = "";
  node.className = className;
  return node;
}

const root = document.getElementById("confirmed");
const claimId = new URLSearchParams(window.location.search).get("c") || "";

const ROLE_LABELS = { boy: "Boy", girl: "Girl", child: "Child", mom: "Mom", dad: "Dad", grandmother: "Grandmother", grandfather: "Grandfather", adult: "Adult" };
const CHILD_ROLES = new Set(["boy", "girl", "child"]);

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

async function start() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    root.innerHTML = "";
    const card = el("div", "card auth-card");
    card.appendChild(el("p", null, "Sign in to see your confirmation."));
    const link = el("a", "btn btn-primary", "Sign in");
    link.href = "/signin.html";
    card.appendChild(link);
    root.appendChild(card);
    return;
  }

  const [{ data: claims }, { data: details }] = await Promise.all([
    supabase.from("my_claims").select("*").eq("id", claimId).limit(1),
    supabase.rpc("drop_off_details"),
  ]);
  const claim = claims?.[0];
  if (!claim) {
    root.innerHTML = "";
    const card = el("div", "card");
    card.append(el("h2", null, "No confirmation to show"), el("p", "muted", "This claim isn't yours, or it no longer exists."));
    const link = el("a", "btn btn-outline", "Go to my families");
    link.href = "/mine.html";
    card.appendChild(link);
    root.appendChild(card);
    return;
  }

  const [{ data: members }, { data: items }] = await Promise.all([
    supabase.from("my_household_members").select("*").eq("household_id", claim.household_id).order("position"),
    supabase.from("my_wish_items").select("*").eq("household_id", claim.household_id).order("position"),
  ]);
  const drop = Array.isArray(details) ? details[0] : details;

  root.innerHTML = "";
  const head = el("div", "confirmed-head");
  const gifts = el("div", "confirmed-gifts");
  gifts.append(img("gift-small.svg", "confirmed-gift"), img("gift-small.svg", "confirmed-gift"), img("gift-small.svg", "confirmed-gift"));
  head.append(
    el("div", "confirmed-mark", "✓"),
    el("h1", null, `You're Sponsoring Family ${claim.ref_code}`),
    el("p", "muted", `${claim.summary}. This family is off the public list now — it's yours.`),
    el("p", "confirmed-thanks", "Thank you for making Holiday dreams come true!"),
    gifts,
  );
  root.appendChild(head);

  const cols = el("div", "two-col");
  const dropCard = el("div", "card");
  dropCard.appendChild(el("p", "eyebrow eyebrow-xmas", "Drop off the gifts"));
  const facts = el("ul", "row-list");
  const fact = (label, value) => {
    const li = el("li");
    li.append(el("span", "muted", label), el("span", "actions", value));
    return li;
  };
  facts.append(
    fact("By", drop ? formatDate(drop.gifts_due) : "—"),
    fact("Where", drop?.drop_off_address ?? "—"),
    fact("Hours", drop?.drop_off_hours ?? "—"),
  );
  dropCard.appendChild(facts);
  dropCard.appendChild(el("p", "muted small", "Unwrapped, please — the coordinator sorts gifts by household before they go out. Tag bags with the family number."));
  if (drop) dropCard.appendChild(el("p", "muted small", `Questions: ${drop.coordinator_name} · ${drop.contact_phone} · ${drop.contact_email}`));

  const listCard = el("div", "card");
  listCard.appendChild(el("p", "eyebrow eyebrow-xmas", "What to buy"));
  const people = el("div", "stack");
  for (const m of members ?? []) {
    const own = (items ?? []).filter((i) => i.member_id === m.id);
    const block = el("div");
    const h = el("h3");
    h.append(el("span", "person-label", personLabel(m)), el("span", "sizes"));
    if (m.clothing_size) h.lastChild.appendChild(el("span", "size", m.clothing_size));
    if (m.shoe_size) h.lastChild.appendChild(el("span", "size", m.shoe_size));
    block.appendChild(h);
    const ul = el("ul", "plain-list");
    for (const i of own) {
      const li = el("li");
      li.append(el("b", null, i.kind === "need" ? "Needs:" : "Would love:"), document.createTextNode(` ${i.label}`));
      ul.appendChild(li);
    }
    block.appendChild(ul);
    people.appendChild(block);
  }
  listCard.appendChild(people);
  cols.append(dropCard, listCard);
  root.appendChild(cols);

  const actions = el("div", "form-actions");
  const mine = el("a", "btn btn-green", "Go to My Families");
  mine.href = "/mine.html";
  const print = el("button", "btn btn-outline", "Print the Wish List");
  print.type = "button";
  print.onclick = () => window.print();
  actions.append(mine, print);
  root.appendChild(actions);
}

await start();
