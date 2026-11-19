// The dashboard (A1): the whole drive in one look. Four tiles, a progress
// bar, a needs-attention line, and the roster. Everything is computed in
// the browser from one fetch of the households: at most a few hundred
// rows, which is nothing, and one query is easier to reason about than
// six counts.
//
// Sponsorship comes from claims_with_sponsor, which only the admin can
// read: an active claim (claimed or delivered) is what "sponsored" means.
import { supabase } from "./auth.js";
import { mountConsole, requireSession, formatDate } from "./console.js";
import { toCsv, downloadCsv } from "./csv.js";
import { renderWishList, printerIcon } from "./wishlist-print.js";
import { byFamilyNumber, inBatches, matchesSearch, quickSelect, printLabel, selectionText } from "./print-picker.js";

const root = document.getElementById("dashboard-root");
const tiles = document.getElementById("tiles");
const roster = document.getElementById("roster");
const attention = document.getElementById("attention");
const printRoot = document.getElementById("print-root");
const printError = document.getElementById("print-error");
const openPicker = document.getElementById("open-picker");
const picker = document.getElementById("picker");
const pickerSearch = document.getElementById("picker-search");
const pickerRows = document.getElementById("picker-rows");
const pickerEmpty = document.getElementById("picker-empty");
const pickerCount = document.getElementById("picker-count");
const pickerPrint = document.getElementById("picker-print");
const pickerPrintLabel = document.getElementById("picker-print-label");

// Approved families are the only ones with a wish list worth printing.
// Pending, rejected and withdrawn rows get no Print button.
const PRINTABLE = new Set(["live", "sponsored", "delivered"]);

let households = [];
let claims = [];
let campaign = null;

const STATUS = {
  pending_review: ["pill-pending", "Pending review"],
  live: ["pill-live", "Needs a sponsor"],
  sponsored: ["pill-sponsored", "Sponsored"],
  delivered: ["pill-delivered", "Delivered"],
  rejected: ["pill-rejected", "Rejected"],
  withdrawn: ["pill-withdrawn", "Withdrawn"],
};

// A live household with an active claim is "sponsored" or "delivered" on
// screen; the households table never stores that, the claims table does.
function activeClaim(h) {
  return claims.find((c) => c.household_id === h.id && c.status !== "released");
}

function shownStatus(h) {
  const claim = activeClaim(h);
  if (h.status === "live" && claim) return claim.status === "delivered" ? "delivered" : "sponsored";
  return h.status;
}

function sponsorOf(h) {
  const claim = activeClaim(h);
  if (!claim) return "";
  return claim.sponsor_email || (claim.sponsor_label ? `offline: ${claim.sponsor_label}` : "sponsor");
}

// household_contacts is admin-only and joined here the same way queue.js
// already does it — Supabase returns the embed as an array even though
// it's a one-to-one relationship.
function contactOf(h) {
  const contact = h.household_contacts;
  return (Array.isArray(contact) ? contact[0] : contact) ?? null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function daysUntil(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function tile(number, label, sub, tone) {
  const card = el("div", `card tile ${tone ?? ""}`);
  card.append(el("div", "num", String(number)), el("div", "label", label), el("div", "muted small", sub));
  return card;
}

function renderTiles() {
  const pending = households.filter((h) => h.status === "pending_review").length;
  const live = households.filter((h) => shownStatus(h) === "live").length;
  const sponsored = households.filter((h) => ["sponsored", "delivered"].includes(shownStatus(h))).length;
  const delivered = households.filter((h) => shownStatus(h) === "delivered").length;
  const received = households.filter((h) => h.status !== "withdrawn").length;
  const days = campaign ? daysUntil(campaign.gifts_due) : null;

  tiles.innerHTML = "";
  tiles.append(
    tile(received, "Referrals received", `${pending} still awaiting review`),
    tile(live, "Need a sponsor", "live on the public list", "green"),
    tile(sponsored, "Sponsored", `${delivered} already delivered`),
    tile(days ?? "—", "Days to drop-off", campaign ? `gifts due ${formatDate(campaign.gifts_due)}` : "", "red"),
  );

  const approved = live + sponsored;
  const percent = approved ? Math.round((sponsored / approved) * 100) : 0;
  document.getElementById("progress-label").textContent = `${sponsored} of ${approved} approved households sponsored`;
  document.getElementById("progress-percent").textContent = `${percent}%`;
  document.getElementById("progress-bar").style.width = `${percent}%`;
  document.getElementById("deadlines").textContent = campaign
    ? `Nominations close ${formatDate(campaign.nominations_close)} · Claims close ${formatDate(campaign.claims_close)}`
    : "";

  if (pending > 0) {
    attention.textContent = `Needs attention — ${pending} referral${pending === 1 ? "" : "s"} waiting for review.`;
    attention.classList.remove("hidden");
  } else {
    attention.classList.add("hidden");
  }
}

function renderRoster() {
  roster.innerHTML = "";
  if (!households.length) {
    roster.appendChild(el("p", "empty", "No households yet."));
    return;
  }

  const table = el("table", "table");
  const head = table.createTHead().insertRow();
  for (const label of ["ID", "Name", "Provider", "Household", "Status", "Sponsor", "Updated", ""]) {
    head.appendChild(el("th", null, label));
  }
  const body = table.createTBody();
  for (const h of households) {
    const row = body.insertRow();
    row.insertCell().appendChild(el("strong", null, h.ref_code));
    const contact = contactOf(h);
    row.insertCell().textContent = contact?.household_first_name || "—";
    row.insertCell().textContent = contact?.referral_source || "—";
    row.insertCell().textContent = h.summary;
    const [cls, label] = STATUS[shownStatus(h)] ?? ["pill-grey", h.status];
    row.insertCell().appendChild(el("span", `pill ${cls}`, label));
    row.insertCell().textContent = sponsorOf(h) || "—";
    row.insertCell().textContent = new Date(h.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const buttons = el("div", "cell-actions");
    if (PRINTABLE.has(shownStatus(h))) {
      const print = el("button", "btn btn-outline btn-sm", "Print");
      print.type = "button";
      print.prepend(printerIcon());
      print.setAttribute("aria-label", `Print the wish list for family ${h.ref_code}`);
      // Only the id leaves the row, never `h` itself: the row also carries
      // the family's first name and provider.
      print.onclick = () => printFamilies([h.id], print);
      buttons.appendChild(print);
    }
    const open = el("a", "btn btn-outline btn-sm", h.status === "pending_review" ? "Review" : "Open");
    open.href = `/queue.html?select=${encodeURIComponent(h.id)}`;
    buttons.appendChild(open);
    row.insertCell().appendChild(buttons);
  }
  roster.appendChild(table);
}

// The coordinator's copies, for one family or many: the roster's Print
// button and the "Print wish lists" picker both end up here. It is handed
// ids and nothing else, then asks the database again for each family's
// number, summary and status. A family withdrawn or rejected since the
// page loaded is left out: the database decides what prints, not the
// button or the checkbox list. Every column is named. Admin-only by RLS:
// anyone else gets zero rows back.
async function printFamilies(ids, button) {
  printError.classList.add("hidden");
  button.disabled = true;
  try {
    // 1. Which of these families are still approved?
    const found = [];
    for (const batch of inBatches(ids)) {
      const { data, error } = await supabase.from("households").select("id, ref_code, summary, status").in("id", batch);
      if (error) {
        showPrintError(`Couldn't load the wish lists: ${error.message}`);
        return;
      }
      found.push(...data);
    }
    // Nothing at all means RLS refused the read — usually a sign-in that
    // expired since the page loaded.
    if (!found.length) {
      showPrintError("Couldn't load the wish lists. Reload the page and sign in again.");
      return;
    }
    const approved = found.filter((row) => row.status === "live");
    const leftOut = found.filter((row) => row.status !== "live").map((row) => row.ref_code);
    if (!approved.length) {
      showPrintError(`Nothing printed: ${leftOut.join(", ")} ${leftOut.length === 1 ? "is" : "are"} no longer approved.`);
      return;
    }

    // 2. Their people and wish items, a batch at a time.
    const members = [];
    const items = [];
    for (const batch of inBatches(approved.map((row) => row.id))) {
      const [memberRows, itemRows] = await Promise.all([
        supabase.from("household_members").select("id, household_id, role, age, clothing_size, shoe_size").in("household_id", batch).order("position"),
        supabase.from("wish_items").select("household_id, member_id, kind, label").in("household_id", batch).order("position"),
      ]);
      const failed = memberRows.error ?? itemRows.error;
      if (failed) {
        showPrintError(`Couldn't load the wish lists: ${failed.message}`);
        return;
      }
      members.push(...memberRows.data);
      items.push(...itemRows.data);
    }
    // Every referral has at least one person, so a family with none means
    // its rows were refused, not that it has nothing to print.
    const missing = approved.find((row) => !members.some((m) => m.household_id === row.id));
    if (missing) {
      showPrintError(`Couldn't load the wish list for family ${missing.ref_code}. Reload the page and sign in again.`);
      return;
    }
    const { data: details } = await supabase.rpc("drop_off_details");
    const drop = Array.isArray(details) ? details[0] : details;

    // 3. One page per family, in family-number order.
    const pages = approved
      .map((row) => ({ id: row.id, refCode: row.ref_code, summary: row.summary }))
      .sort(byFamilyNumber)
      .map((family) => {
        const page = el("section", "print-family");
        page.appendChild(renderWishList({
          refCode: family.refCode,
          members: members.filter((m) => m.household_id === family.id),
          items: items.filter((i) => i.household_id === family.id),
          drop,
          copy: "coordinator",
          summary: family.summary,
        }));
        return page;
      });
    if (leftOut.length) {
      showPrintError(`Left out ${leftOut.join(", ")}: no longer approved, so not printed.`);
    }
    printRoot.replaceChildren(...pages);
    document.body.classList.add("printing-wishlist");
    window.print();
  } finally {
    button.disabled = false;
  }
}

// The message sits above the roster, so a coordinator who clicked Print
// far down the list would never see it without the scroll.
function showPrintError(message) {
  printError.textContent = message;
  printError.classList.remove("hidden");
  printError.scrollIntoView({ block: "center" });
}

// When the print dialog closes — printed or cancelled — put the dashboard
// back exactly as it was.
window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-wishlist");
  printRoot.replaceChildren();
});

// The export. Pending rows included (the handbook flagged their absence as
// a gap). Name and provider are allowed here by name only (CLAUDE.md,
// 2026-11-03) — everything else in household_contacts (email, phone,
// contact_is, the coordinator note) stays out. No wildcard embed, no
// spreading `contact` into the row: every field that leaves here must be
// named on purpose.
document.getElementById("export").onclick = () => {
  const rows = households.map((h) => {
    const contact = contactOf(h);
    return {
      id: h.ref_code,
      name: contact?.household_first_name ?? "",
      provider: contact?.referral_source ?? "",
      household: h.summary,
      status: shownStatus(h),
      sponsor: sponsorOf(h),
      updated: new Date(h.updated_at).toISOString().slice(0, 10),
    };
  });
  const columns = [["id", "id"], ["name", "name"], ["provider", "provider"], ["household", "household"], ["status", "status"], ["sponsor", "sponsor"], ["updated", "updated"]];
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`sub-for-santa-roster-${stamp}.csv`, toCsv(rows, columns));
};

// ---------- The "Print wish lists" picker ----------
//
// Approved families only, in number order, each with a checkbox. What's
// ticked is a Set of household ids kept here, not read back from the
// checkboxes, and printFamilies checks every id with the database again
// before anything prints.

let offered = []; // the families the picker lists, refreshed on each open
let selected = new Set();

// Four named fields per approved family, copied out of the roster rows:
// the picker shows number, summary and status, never a name.
function approvedFamilies() {
  return households
    .filter((h) => PRINTABLE.has(shownStatus(h)))
    .map((h) => ({ id: h.id, refCode: h.ref_code, summary: h.summary, status: shownStatus(h) }))
    .sort(byFamilyNumber);
}

function pickerRow(family) {
  const row = el("label", "picker-row");
  const box = el("input");
  box.type = "checkbox";
  box.checked = selected.has(family.id);
  box.onchange = () => {
    if (box.checked) selected.add(family.id);
    else selected.delete(family.id);
    renderPickerCount();
  };
  const [cls, label] = STATUS[family.status];
  row.append(box, el("span", "picker-num", family.refCode), el("span", "picker-summary", family.summary), el("span", `pill ${cls}`, label));
  return row;
}

// Redraws the rows the search box lets through. Ticks on the rows it
// hides are kept, and still count.
function renderPickerRows() {
  const shown = offered.filter((family) => matchesSearch(family.refCode, pickerSearch.value));
  pickerRows.replaceChildren(...shown.map(pickerRow));
  pickerEmpty.textContent = offered.length
    ? "No approved family with that number. Families still pending review aren't listed."
    : "No approved families yet. Families still pending review aren't listed.";
  pickerEmpty.classList.toggle("hidden", shown.length > 0);
}

// Only the count and the button change when a box is ticked, so the
// checkbox under the coordinator's finger (or keyboard) stays put.
function renderPickerCount() {
  pickerCount.textContent = selectionText(selected.size);
  pickerPrintLabel.textContent = printLabel(selected.size);
  pickerPrint.disabled = selected.size === 0;
}

openPicker.prepend(printerIcon());
pickerPrint.prepend(printerIcon());

openPicker.onclick = () => {
  offered = approvedFamilies();
  selected = new Set(); // opens with nothing ticked (decided 2026-11-19)
  pickerSearch.value = "";
  renderPickerRows();
  renderPickerCount();
  picker.showModal();
};

pickerSearch.oninput = renderPickerRows;

for (const button of picker.querySelectorAll("[data-pick]")) {
  button.onclick = () => {
    selected = quickSelect(button.dataset.pick, offered);
    renderPickerRows();
    renderPickerCount();
  };
}

// Cancel and the × close it, and so does Escape, which the browser
// handles. Closing changes nothing on the dashboard.
for (const button of picker.querySelectorAll("[data-close]")) {
  button.onclick = () => picker.close();
}

// The picker closes first, so it can never end up on the printout.
pickerPrint.onclick = () => {
  picker.close();
  printFamilies([...selected], openPicker);
};

async function load() {
  const [{ data: campaigns }, { data, error }, { data: claimRows }] = await Promise.all([
    supabase.from("public_campaign").select("*").limit(1),
    supabase
      .from("households")
      .select("id, ref_code, summary, status, referred_on, updated_at, household_contacts ( household_first_name, referral_source )")
      .order("status", { ascending: true })
      .order("referred_on", { ascending: true }),
    supabase.from("claims_with_sponsor").select("*"),
  ]);
  campaign = campaigns?.[0] ?? null;
  claims = claimRows ?? [];

  if (error) {
    root.innerHTML = "";
    root.appendChild(el("p", "notice notice-red", `Couldn't load the dashboard: ${error.message}`));
    return;
  }
  households = data;
  renderTiles();
  renderRoster();
}

mountConsole({ title: "Dashboard" });
const session = await requireSession(root);
if (session) await load();
