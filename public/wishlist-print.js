// The printable wish list: drop-off details, each person's sizes and wish
// items with a tick box, four cut-out bag tags, and a footer. The donor's
// confirmation page shows it today; the coordinator's print buttons (Epic
// #30) reuse it rather than drawing a second copy.
//
// It is handed named values, never a whole database row. That is the
// safety rule for anything that ends up on paper: paper is outside the
// Feb 12 purge and outside RLS, so a family name or contact detail that
// reached this function by accident would leave the building. If a field
// isn't in the parameter list below, this page cannot print it.
import { formatDate } from "./console.js";

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

// refCode  — the family number, e.g. "#14"
// members  — rows with id, role, age, clothing_size, shoe_size
// items    — rows with member_id, kind ("need" or "would_love"), label
// drop     — drop_off_details(): gifts_due, drop_off_address,
//            drop_off_hours, coordinator_name, contact_phone, contact_email
//            (null if it couldn't be read)
// copy     — "donor" (the default) or "coordinator". The coordinator copy
//            is the donor's page with one line on top saying whose copy
//            it is and when it was printed; nothing else differs.
// summary  — coordinator copy only: the household summary shown on Browse
//
// Returns a DocumentFragment for the caller to append.
export function renderWishList({ refCode, members, items, drop, copy = "donor", summary }) {
  const page = document.createDocumentFragment();

  // The donor page draws its own heading ("You're Sponsoring Family #N");
  // the coordinator copy has no page around it, so it brings its own.
  if (copy === "coordinator") {
    const printed = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    page.appendChild(el("p", "coord-copy-stamp", `Coordinator copy · Printed ${printed}`));
    const head = el("div", "coord-head");
    head.append(el("h1", null, `Family ${refCode}`), el("p", "muted", summary ?? ""));
    page.appendChild(head);
  }

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
  if (drop) dropCard.appendChild(el("p", "muted small drop-contact", `Questions: ${drop.coordinator_name} · ${drop.contact_phone} · ${drop.contact_email}`));

  const listCard = el("div", "card");
  const listHead = el("div", "list-head");
  listHead.append(el("p", "eyebrow eyebrow-xmas", "What to buy"), el("span", "muted small", "Tick each gift as you buy it"));
  listCard.appendChild(listHead);
  const people = el("div", "stack");
  for (const m of members ?? []) {
    const own = (items ?? []).filter((i) => i.member_id === m.id);
    const block = el("div", "wish-person");
    const h = el("h3");
    h.append(el("span", "person-label", personLabel(m)), el("span", "sizes"));
    if (m.clothing_size) h.lastChild.appendChild(el("span", "size", `Clothing: ${m.clothing_size}`));
    if (m.shoe_size) h.lastChild.appendChild(el("span", "size", `Shoes: ${m.shoe_size}`));
    block.appendChild(h);
    const ul = el("ul", "plain-list");
    for (const i of own) {
      const li = el("li");
      li.append(el("span", "tick-box"), el("b", null, i.kind === "need" ? "Needs:" : "Would love:"), document.createTextNode(` ${i.label}`));
      ul.appendChild(li);
    }
    block.appendChild(ul);
    people.appendChild(block);
  }
  listCard.appendChild(people);
  cols.append(dropCard, listCard);
  page.appendChild(cols);

  const tags = el("div", "bag-tags");
  tags.appendChild(el("p", "muted small", "Cut out and tape one to each bag."));
  const tagsRow = el("div", "bag-tags-row");
  for (let i = 0; i < 4; i++) {
    const tag = el("div", "bag-tag");
    tag.append(el("div", null, refCode), el("div", "bag-tag-sub", "Sub for Santa 2026"));
    tagsRow.appendChild(tag);
  }
  tags.appendChild(tagsRow);
  page.appendChild(tags);

  const printFooter = el("div", "print-footer");
  printFooter.appendChild(el("span", null, `Family ${refCode}`));
  if (drop) printFooter.appendChild(el("span", null, `Questions: ${drop.coordinator_name} · ${drop.contact_phone} · ${drop.contact_email}`));
  page.appendChild(printFooter);

  return page;
}
