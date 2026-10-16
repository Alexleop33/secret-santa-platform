// The admin's referrals page: what is waiting for her review, what she has
// approved, and what she has rejected. Three sections on one page, one
// query, one row renderer. Reuses auth.js's Supabase client rather than
// creating a second one — same project, same session, one place that knows
// how to talk to it.
import { supabase } from "./auth.js";
import { env } from "./config.js";

const root = document.getElementById("queue-root");
const whoami = document.getElementById("whoami");
const envPill = document.getElementById("env-pill");
const navPendingCount = document.getElementById("nav-pending-count");

// One section per status. "Waiting for review" starts open because that is
// the daily job; the other two are reference and start folded. The
// browser's own <details> element does the folding — no CSS, no script.
// Only the pending section gets Approve/Reject buttons: changing a decision
// once made is deliberately not something this page can do.
const SECTIONS = [
  {
    status: "pending_review",
    title: "Waiting for review",
    empty: "Nothing is waiting for review right now.",
    open: true,
    canResolve: true,
  },
  {
    status: "live",
    title: "Approved",
    empty: "Nothing has been approved yet.",
    open: false,
    canResolve: false,
  },
  {
    status: "rejected",
    title: "Rejected",
    empty: "Nothing has been rejected.",
    open: false,
    canResolve: false,
  },
];

function renderSignedOut() {
  root.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card auth-card";
  const message = document.createElement("p");
  message.textContent = "Sign in to view referrals.";
  const link = document.createElement("a");
  link.href = "/";
  link.className = "btn btn-primary";
  link.textContent = "Sign in";
  card.append(message, link);
  root.appendChild(card);
}

function renderError(error) {
  root.innerHTML = "";
  const message = document.createElement("p");
  message.className = "notice notice-red";
  message.textContent = `Couldn't load referrals: ${error.message}`;
  root.appendChild(message);
}

// The sandbox pill says which database this page is talking to. It never
// renders on the live site, where there is nothing to warn about.
function renderChrome(session) {
  if (whoami) whoami.textContent = session.user.email;
  if (envPill && env !== "prod") {
    envPill.textContent = env === "local" ? "Local database" : "Sandbox data";
    envPill.classList.remove("hidden");
  }
}

// Build the three sections once. Re-fetching only replaces what is inside
// each one, so a section the admin has opened or folded stays that way
// after she approves something.
function buildSections() {
  root.innerHTML = "";
  for (const section of SECTIONS) {
    section.details = document.createElement("details");
    section.details.className = "section";
    section.details.open = section.open;
    section.heading = document.createElement("summary");
    section.title_el = document.createElement("span");
    section.title_el.textContent = section.title;
    section.count_el = document.createElement("span");
    section.count_el.className = "count";
    section.heading.append(section.title_el, section.count_el);
    section.body = document.createElement("div");
    section.details.append(section.heading, section.body);
    root.appendChild(section.details);
  }
}

function renderRow(row, canResolve) {
  const item = document.createElement("li");
  const ref = document.createElement("span");
  ref.className = "ref";
  ref.textContent = row.ref_code;
  const text = document.createElement("span");
  text.textContent = row.summary;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = `referred ${new Date(row.referred_on).toLocaleDateString()}`;
  item.append(ref, text, meta);

  // Buttons render for anyone who can see a pending row — and only the
  // admin can see one, because the SELECT policy says so. A role check
  // here would just be a second query to prove what the database already
  // decided.
  if (canResolve) {
    const actions = document.createElement("div");
    actions.className = "actions";
    const approveButton = document.createElement("button");
    approveButton.className = "btn btn-green btn-sm";
    approveButton.textContent = "Approve";
    approveButton.onclick = () => resolveReferral(row.id, "live");

    const rejectButton = document.createElement("button");
    rejectButton.className = "btn btn-danger btn-sm";
    rejectButton.textContent = "Reject";
    rejectButton.onclick = () => resolveReferral(row.id, "rejected");

    actions.append(approveButton, rejectButton);
    item.appendChild(actions);
  }
  return item;
}

// Same message whether a section is genuinely empty or the caller isn't
// the admin — RLS already decided which one happened, and this page has no
// way to tell the difference (on purpose). The count in each heading is the
// number mum actually wants: how many are waiting, how many are approved.
function renderSections(rows) {
  for (const section of SECTIONS) {
    const matching = rows.filter((row) => row.status === section.status);
    section.count_el.textContent = `(${matching.length})`;
    section.body.innerHTML = "";
    if (section.status === "pending_review" && navPendingCount) {
      navPendingCount.textContent = matching.length ? String(matching.length) : "";
    }

    if (matching.length === 0) {
      const message = document.createElement("p");
      message.className = "empty";
      message.textContent = section.empty;
      section.body.appendChild(message);
      continue;
    }

    const list = document.createElement("ul");
    list.className = "row-list";
    for (const row of matching) {
      list.appendChild(renderRow(row, section.canResolve));
    }
    section.body.appendChild(list);
  }
}

// One query, no status filter: ask for every household this caller is
// allowed to see, then sort them into sections here. The policy is what
// actually decides who can read what — for anyone but the admin this comes
// back empty, and all three sections say so.
async function loadHouseholds() {
  const { data, error } = await supabase
    .from("households")
    .select("id, ref_code, summary, status, referred_on")
    .order("referred_on", { ascending: true });

  if (error) {
    renderError(error);
  } else {
    renderSections(data);
  }
}

// Re-fetching afterwards is what proves the write landed: the row shows up
// under Approved or Rejected because the database says so, not because
// this page moved it there itself.
async function resolveReferral(id, status) {
  const { error } = await supabase
    .from("households")
    .update({ status })
    .eq("id", id);

  if (error) {
    renderError(error);
    return;
  }

  await loadHouseholds();
}

const { data: sessionData } = await supabase.auth.getSession();

if (!sessionData.session) {
  renderSignedOut();
} else {
  renderChrome(sessionData.session);
  buildSections();
  await loadHouseholds();
}
