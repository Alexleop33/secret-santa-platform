// Confirmed (D5): know exactly what to do next. The drop-off details come
// from drop_off_details(), which only answers a caller who holds a claim.
// There is no family contact card here and never will be: gifts go to the
// drop-off point, and the coordinator sorts them by household.
import { supabase } from "./auth.js";
import { renderWishList } from "./wishlist-print.js";

function img(file, className) {
  const node = document.createElement("img");
  node.src = `/assets/${file}`;
  node.alt = "";
  node.className = className;
  return node;
}

function printerIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z");
  svg.appendChild(path);
  return svg;
}

const root = document.getElementById("confirmed");
const claimId = new URLSearchParams(window.location.search).get("c") || "";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

  const banner = el("div", "print-banner");
  const bannerIcon = el("span", "print-banner-icon");
  bannerIcon.appendChild(printerIcon());
  const bannerText = el("div", "print-banner-text");
  bannerText.append(
    el("p", null, "Shopping in a store? Take the list with you."),
    el("p", "print-banner-sub", "One page with every size, the wish list, and where to drop off."),
  );
  const bannerPrint = el("button", "btn btn-primary", "Print the Wish List");
  bannerPrint.type = "button";
  bannerPrint.prepend(printerIcon());
  bannerPrint.onclick = () => window.print();
  banner.append(bannerIcon, bannerText, bannerPrint);
  root.appendChild(banner);

  // The printable part — drop-off, wish list, bag tags, footer — lives in
  // wishlist-print.js so the coordinator's print buttons can reuse it.
  // Only named fields go in; never the whole claim row.
  root.appendChild(renderWishList({ refCode: claim.ref_code, members, items, drop }));

  const actions = el("div", "form-actions");
  const mine = el("a", "btn btn-green", "Go to My Families");
  mine.href = "/mine.html";
  actions.append(mine);
  root.appendChild(actions);
}

await start();
