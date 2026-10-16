// Exceptions and the activity log (A3). The log is live now; the exception
// cards that need sponsors (released, undelivered, offline sponsor) arrive
// with the donor side. Until then the left column shows what can fall out
// of the happy path today: referrals waiting too long.
import { supabase } from "./auth.js";
import { mountConsole, requireSession } from "./console.js";
import { toCsv, downloadCsv } from "./csv.js";

const root = document.getElementById("exceptions-root");
const exceptions = document.getElementById("exceptions");
const activityRoot = document.getElementById("activity");

let entries = [];

const ACTIONS = {
  referral_submitted: "submitted a referral",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrew",
};

const ROLES = { admin: "coordinator", donor: "sponsor", family: "family", system: "system" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function describe(entry) {
  const who = ROLES[entry.actor_role] ?? entry.actor_role;
  const what = ACTIONS[entry.action] ?? entry.action.replaceAll("_", " ");
  return entry.action === "referral_submitted"
    ? `Referral ${entry.target_ref_code} submitted`
    : `${entry.target_ref_code} ${what} by the ${who}`;
}

function renderActivity() {
  activityRoot.innerHTML = "";
  if (!entries.length) {
    activityRoot.appendChild(el("p", "empty", "Nothing has happened yet."));
    return;
  }
  const list = el("ul", "row-list");
  for (const entry of entries) {
    const item = el("li");
    const text = el("span");
    text.append(el("span", null, describe(entry)), el("br"), el("span", "meta", `${ROLES[entry.actor_role] ?? entry.actor_role} · ${new Date(entry.happened_at).toLocaleString()}`));
    item.appendChild(text);
    list.appendChild(item);
  }
  activityRoot.appendChild(list);
}

function renderExceptions(households) {
  exceptions.innerHTML = "";
  const stale = households.filter((h) => h.status === "pending_review" && Date.now() - new Date(h.referred_on) > 2 * 86400000);
  if (!stale.length) {
    const card = el("div", "card");
    card.append(el("p", "eyebrow", "Needs attention"), el("p", "muted", "Nothing is waiting on you right now. Released and undelivered households will show here once sponsors can claim."));
    exceptions.appendChild(card);
    return;
  }
  for (const h of stale) {
    const card = el("div", "card");
    card.append(
      el("p", "eyebrow", "Waiting more than two days"),
      el("h3", null, `${h.ref_code} is still pending review`),
      el("p", "muted small", `${h.summary} · referred ${new Date(h.referred_on).toLocaleDateString()}`),
    );
    const open = el("a", "btn btn-green btn-sm", "Review it");
    open.href = `/queue.html?select=${encodeURIComponent(h.id)}`;
    card.appendChild(open);
    exceptions.appendChild(card);
  }
}

document.getElementById("export-activity").onclick = () => {
  const rows = entries.map((e) => ({
    when: e.happened_at,
    who: e.actor_role,
    action: e.action,
    household: e.target_ref_code,
  }));
  const columns = [["when", "when"], ["who", "who"], ["action", "action"], ["household", "household"]];
  downloadCsv(`sub-for-santa-activity-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns));
};

async function load() {
  const [{ data: activity, error }, { data: households }] = await Promise.all([
    supabase.from("activity").select("id, happened_at, actor_role, action, target_ref_code").order("happened_at", { ascending: false }).limit(100),
    supabase.from("households").select("id, ref_code, summary, status, referred_on"),
  ]);
  if (error) {
    root.innerHTML = "";
    root.appendChild(el("p", "notice notice-red", `Couldn't load: ${error.message}`));
    return;
  }
  entries = activity;
  renderActivity();
  renderExceptions(households ?? []);
}

mountConsole({ title: "Exceptions" });
const session = await requireSession(root);
if (session) await load();
