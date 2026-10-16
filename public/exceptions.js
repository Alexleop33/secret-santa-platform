// Exceptions and the activity log (A3): what falls out of the happy path,
// and the record of everything that happened. Cards, in the order the
// handbook draws them: released households, claims with no delivery close
// to the deadline, the offline sponsor, and referrals waiting too long.
//
// Sponsor emails appear here for the admin to use herself: the app sends
// no email (decided 2026-10-15). "Send a reminder" is a mailto link.
import { supabase } from "./auth.js";
import { mountConsole, requireSession, formatDate } from "./console.js";
import { toCsv, downloadCsv } from "./csv.js";

const root = document.getElementById("exceptions-root");
const exceptions = document.getElementById("exceptions");
const activityRoot = document.getElementById("activity");

let entries = [];
let households = [];
let claims = [];
let campaign = null;

const ACTIONS = {
  referral_submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrawn",
  claimed: "claimed",
  released: "released",
  delivered: "marked delivered",
};
const ROLES = { admin: "coordinator", donor: "sponsor", family: "family", system: "system" };

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

function describe(entry) {
  const who = ROLES[entry.actor_role] ?? entry.actor_role;
  const what = ACTIONS[entry.action] ?? entry.action.replaceAll("_", " ");
  if (entry.action === "referral_submitted") return `Referral ${entry.target_ref_code} submitted`;
  return `${entry.target_ref_code} ${what} by the ${who}${entry.detail ? ` (${entry.detail})` : ""}`;
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

function card(eyebrow, title, body) {
  const c = el("div", "card");
  c.append(el("p", "eyebrow", eyebrow), el("h3", null, title));
  if (body) c.appendChild(el("p", "muted small", body));
  return c;
}

function sponsorName(claim) {
  return claim.sponsor_email || (claim.sponsor_label ? `offline sponsor (${claim.sponsor_label})` : "a sponsor");
}

function releaseControl(claim, into) {
  const start = el("button", "btn btn-danger btn-sm", "Release this household");
  start.type = "button";
  start.onclick = () => {
    start.classList.add("hidden");
    const confirm = el("button", "btn btn-danger btn-sm", `Yes, release ${claim.ref_code}`);
    confirm.type = "button";
    confirm.onclick = async () => {
      const { error } = await supabase.rpc("admin_release_claim", { p_claim_id: claim.id });
      if (error) into.appendChild(el("p", "notice notice-red small", error.message));
      await load();
    };
    const cancel = el("button", "btn btn-outline btn-sm", "Keep it");
    cancel.type = "button";
    cancel.onclick = () => load();
    into.append(confirm, cancel);
  };
  into.appendChild(start);
}

function renderExceptions() {
  exceptions.innerHTML = "";
  const now = Date.now();
  let shown = 0;

  // 1. Released in the last two weeks: back on the list, nobody has it yet.
  const released = claims.filter((c) => c.status === "released" && now - new Date(c.released_at) < 14 * 86400000);
  for (const c of released) {
    const stillOpen = !claims.some((o) => o.household_id === c.household_id && o.status !== "released");
    if (!stillOpen) continue;
    const box = card("Released household", `${c.ref_code} was released by its sponsor`, `Released ${formatDate(c.released_at.slice(0, 10))}. It went back on the public list automatically — no one has claimed it since.`);
    const open = el("a", "btn btn-outline btn-sm", "See the listing");
    open.href = `/story.html?h=${encodeURIComponent(c.household_id)}`;
    box.appendChild(open);
    exceptions.appendChild(box);
    shown++;
  }

  // 2. Claimed, not delivered, and the deadline is close or gone.
  const days = campaign ? daysUntil(campaign.gifts_due) : null;
  if (days != null && days <= 10) {
    for (const c of claims.filter((x) => x.status === "claimed")) {
      const box = card("No drop-off confirmed", `No pickup confirmed for ${c.ref_code}`, `Claimed by ${sponsorName(c)} on ${formatDate(c.claimed_at.slice(0, 10))}, no delivery marked yet, and the drop-off deadline is ${days < 0 ? `${-days} days past` : `in ${days} days`}.`);
      const actions = el("div", "form-actions");
      if (c.sponsor_email) {
        const mail = el("a", "btn btn-primary btn-sm", "Send a reminder");
        mail.href = `mailto:${c.sponsor_email}?subject=${encodeURIComponent(`Sub for Santa — Family ${c.ref_code} drop-off`)}`;
        actions.appendChild(mail);
      }
      releaseControl(c, actions);
      box.appendChild(actions);
      exceptions.appendChild(box);
      shown++;
    }
  }

  // 3. Referrals waiting more than two days.
  const stale = households.filter((h) => h.status === "pending_review" && now - new Date(h.referred_on) > 2 * 86400000);
  for (const h of stale) {
    const box = card("Waiting more than two days", `${h.ref_code} is still pending review`, `${h.summary} · referred ${formatDate(h.referred_on.slice(0, 10))}`);
    const open = el("a", "btn btn-green btn-sm", "Review it");
    open.href = `/queue.html?select=${encodeURIComponent(h.id)}`;
    box.appendChild(open);
    exceptions.appendChild(box);
    shown++;
  }

  if (!shown) {
    const box = el("div", "card");
    box.append(el("p", "eyebrow", "Needs attention"), el("p", "muted", "Nothing is waiting on you right now."));
    exceptions.appendChild(box);
  }

  // 4. The offline sponsor: someone phoned the office instead of using the
  // site. Record it so the roster stays the single source of truth.
  const open = households.filter((h) => h.status === "live" && !claims.some((c) => c.household_id === h.id && c.status !== "released"));
  const offline = el("div", "card card-tinted");
  offline.append(el("p", "eyebrow", "Offline sponsor"), el("h3", null, "Someone phoned in to sponsor a household?"), el("p", "muted small", "Record the match here. The household comes off the public list and the roster shows who has it."));
  if (!open.length) {
    offline.appendChild(el("p", "muted small", "Every live household already has a sponsor."));
  } else {
    const form = el("form");
    const row = el("div", "form-row");
    const pick = el("label", "field");
    pick.appendChild(el("span", null, "Household"));
    const select = el("select");
    for (const h of open) {
      const opt = el("option", null, `${h.ref_code} — ${h.summary}`);
      opt.value = h.id;
      select.appendChild(opt);
    }
    pick.appendChild(select);
    const who = el("label", "field");
    who.appendChild(el("span", null, "Who (a note for you, e.g. \"Mrs K, phoned Tuesday\")"));
    const label = document.createElement("input");
    label.type = "text";
    label.maxLength = 80;
    label.required = true;
    who.appendChild(label);
    row.append(pick, who);
    const actions = el("div", "form-actions");
    const save = el("button", "btn btn-green btn-sm", "Record a manual match");
    save.type = "submit";
    const status = el("span", "status-line");
    actions.append(save, status);
    form.onsubmit = async (event) => {
      event.preventDefault();
      status.textContent = "Saving…";
      const { error } = await supabase.rpc("admin_manual_claim", { p_household_id: select.value, p_label: label.value });
      status.textContent = error ? (error.message === "already_claimed" ? "Someone claimed it online a moment ago." : error.message) : "";
      if (!error) await load();
    };
    form.append(row, actions);
    offline.appendChild(form);
  }
  exceptions.appendChild(offline);
}

document.getElementById("export-activity").onclick = () => {
  const rows = entries.map((e) => ({ when: e.happened_at, who: e.actor_role, action: e.action, household: e.target_ref_code, detail: e.detail }));
  const columns = [["when", "when"], ["who", "who"], ["action", "action"], ["household", "household"], ["detail", "detail"]];
  downloadCsv(`sub-for-santa-activity-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns));
};

async function load() {
  const [{ data: activity, error }, { data: householdRows }, { data: claimRows }, { data: campaigns }] = await Promise.all([
    supabase.from("activity").select("id, happened_at, actor_role, action, target_ref_code, detail").order("happened_at", { ascending: false }).limit(100),
    supabase.from("households").select("id, ref_code, summary, status, referred_on"),
    supabase.from("claims_with_sponsor").select("*").order("claimed_at", { ascending: false }),
    supabase.from("public_campaign").select("*").limit(1),
  ]);
  if (error) {
    root.innerHTML = "";
    root.appendChild(el("p", "notice notice-red", `Couldn't load: ${error.message}`));
    return;
  }
  entries = activity;
  households = householdRows ?? [];
  claims = claimRows ?? [];
  campaign = campaigns?.[0] ?? null;
  renderActivity();
  renderExceptions();
}

mountConsole({ title: "Exceptions" });
const session = await requireSession(root);
if (session) await load();
