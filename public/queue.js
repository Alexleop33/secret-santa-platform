// The admin's queue: who's waiting to be reviewed. Reuses auth.js's
// Supabase client rather than creating a second one — same project, same
// session, one place that knows how to talk to it.
import { supabase } from "./auth.js";

const root = document.getElementById("queue-root");

function renderSignedOut() {
  root.innerHTML = "";
  const message = document.createElement("p");
  message.className = "message";
  message.textContent = "Sign in to view the queue.";
  const link = document.createElement("a");
  link.href = "/";
  link.textContent = "Sign in";
  root.append(message, link);
}

function renderError(error) {
  root.innerHTML = "";
  const message = document.createElement("p");
  message.className = "message-error";
  message.textContent = `Couldn't load the queue: ${error.message}`;
  root.appendChild(message);
}

// Same message whether the queue is genuinely empty or the caller isn't
// the admin — RLS already decided which one happened, and this page has
// no way to tell the difference (on purpose).
function renderQueue(rows) {
  root.innerHTML = "";

  if (rows.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "Nothing is waiting for review right now.";
    root.appendChild(message);
    return;
  }

  const list = document.createElement("ul");
  list.className = "list";
  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "list-row";
    const date = new Date(row.referred_on).toLocaleDateString();

    const main = document.createElement("div");
    main.className = "list-row-main";
    const title = document.createElement("div");
    title.className = "list-row-title";
    title.textContent = row.ref_code;
    const meta = document.createElement("div");
    meta.className = "list-row-meta";
    meta.textContent = `${row.summary} (referred ${date})`;
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "list-row-actions";

    // Buttons render for anyone who can see a row — and only the admin
    // can see a row, because the SELECT policy says so. A role check
    // here would just be a second query to prove what the database
    // already decided.
    const approveButton = document.createElement("button");
    approveButton.className = "btn btn-primary btn-sm";
    approveButton.textContent = "Approve";
    approveButton.onclick = () => resolveReferral(row.id, "live");

    const rejectButton = document.createElement("button");
    rejectButton.className = "btn btn-danger btn-sm";
    rejectButton.textContent = "Reject";
    rejectButton.onclick = () => resolveReferral(row.id, "rejected");

    actions.append(approveButton, rejectButton);
    item.append(main, actions);
    list.appendChild(item);
  }
  root.appendChild(list);
}

// The status filter states what this screen is for; the policy is what
// actually enforces who can read what, regardless of this query.
async function loadQueue() {
  const { data, error } = await supabase
    .from("households")
    .select("id, ref_code, summary, referred_on")
    .eq("status", "pending_review")
    .order("referred_on", { ascending: true });

  if (error) {
    renderError(error);
  } else {
    renderQueue(data);
  }
}

// No .select() after the update: once a row is no longer pending_review,
// the SELECT policy can't see it anymore, so asking for it back would
// always come back empty — indistinguishable from a failed write.
// Re-fetching the queue afterwards is what actually proves the write
// landed, rather than assuming it from a local change.
async function resolveReferral(id, status) {
  const { error } = await supabase
    .from("households")
    .update({ status })
    .eq("id", id);

  if (error) {
    renderError(error);
    return;
  }

  await loadQueue();
}

const { data: sessionData } = await supabase.auth.getSession();

if (!sessionData.session) {
  renderSignedOut();
} else {
  await loadQueue();
}
