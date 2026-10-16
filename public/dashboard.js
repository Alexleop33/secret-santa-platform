// The dashboard (A1): the whole drive in one look. Four tiles, a progress
// bar, a needs-attention line, and the roster. Everything is computed in
// the browser from one fetch of the households: at most a few hundred
// rows, which is nothing, and one query is easier to reason about than
// six counts.
//
// Sponsorship does not exist yet; the sponsored tile and column read 0 and
// "—" until the claims slice lands.
import { supabase } from "./auth.js";
import { mountConsole, requireSession, formatDate } from "./console.js";
import { toCsv, downloadCsv } from "./csv.js";

const root = document.getElementById("dashboard-root");
const tiles = document.getElementById("tiles");
const roster = document.getElementById("roster");
const attention = document.getElementById("attention");

let households = [];
let campaign = null;

const STATUS = {
  pending_review: ["pill-pending", "Pending review"],
  live: ["pill-live", "Needs a sponsor"],
  rejected: ["pill-rejected", "Rejected"],
  withdrawn: ["pill-withdrawn", "Withdrawn"],
};

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
  const live = households.filter((h) => h.status === "live").length;
  const received = households.filter((h) => h.status !== "withdrawn").length;
  const sponsored = 0;
  const days = campaign ? daysUntil(campaign.gifts_due) : null;

  tiles.innerHTML = "";
  tiles.append(
    tile(received, "Referrals received", `${pending} still awaiting review`),
    tile(live, "Need a sponsor", "live on the public list", "green"),
    tile(sponsored, "Sponsored", "0 already delivered"),
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
  for (const label of ["ID", "Household", "Status", "Sponsor", "Updated", ""]) {
    head.appendChild(el("th", null, label));
  }
  const body = table.createTBody();
  for (const h of households) {
    const row = body.insertRow();
    row.insertCell().appendChild(el("strong", null, h.ref_code));
    row.insertCell().textContent = h.summary;
    const [cls, label] = STATUS[h.status] ?? ["pill-grey", h.status];
    row.insertCell().appendChild(el("span", `pill ${cls}`, label));
    row.insertCell().textContent = "—";
    row.insertCell().textContent = new Date(h.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const open = el("a", "btn btn-outline btn-sm", h.status === "pending_review" ? "Review" : "Open");
    open.href = `/queue.html?select=${encodeURIComponent(h.id)}`;
    row.insertCell().appendChild(open);
  }
  roster.appendChild(table);
}

// The export. Pending rows included (the handbook flagged their absence as
// a gap). No contact column exists to leave out.
document.getElementById("export").onclick = () => {
  const rows = households.map((h) => ({
    id: h.ref_code,
    household: h.summary,
    status: h.status,
    sponsor: "",
    updated: new Date(h.updated_at).toISOString().slice(0, 10),
  }));
  const columns = [["id", "id"], ["household", "household"], ["status", "status"], ["sponsor", "sponsor"], ["updated", "updated"]];
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`sub-for-santa-roster-${stamp}.csv`, toCsv(rows, columns));
};

async function load() {
  const [{ data: campaigns }, { data, error }] = await Promise.all([
    supabase.from("public_campaign").select("*").limit(1),
    supabase
      .from("households")
      .select("id, ref_code, summary, status, referred_on, updated_at")
      .order("status", { ascending: true })
      .order("referred_on", { ascending: true }),
  ]);
  campaign = campaigns?.[0] ?? null;

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
