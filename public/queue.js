// The admin's queue: who's waiting to be reviewed. Reuses auth.js's
// Supabase client rather than creating a second one — same project, same
// session, one place that knows how to talk to it.
import { supabase } from "./auth.js";

const root = document.getElementById("queue-root");

function renderSignedOut() {
  root.innerHTML = "";
  const message = document.createElement("p");
  message.textContent = "Sign in to view the queue.";
  const link = document.createElement("a");
  link.href = "/";
  link.textContent = "Sign in";
  root.append(message, link);
}

function renderError(error) {
  root.innerHTML = "";
  const message = document.createElement("p");
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
    message.textContent = "Nothing is waiting for review right now.";
    root.appendChild(message);
    return;
  }

  const list = document.createElement("ul");
  for (const row of rows) {
    const item = document.createElement("li");
    const date = new Date(row.referred_on).toLocaleDateString();
    item.textContent = `${row.ref_code} — ${row.summary} (referred ${date})`;
    list.appendChild(item);
  }
  root.appendChild(list);
}

const { data: sessionData } = await supabase.auth.getSession();

if (!sessionData.session) {
  renderSignedOut();
} else {
  // The status filter states what this screen is for; the policy is what
  // actually enforces who can read what, regardless of this query.
  const { data, error } = await supabase
    .from("households")
    .select("ref_code, summary, referred_on")
    .eq("status", "pending_review")
    .order("referred_on", { ascending: true });

  if (error) {
    renderError(error);
  } else {
    renderQueue(data);
  }
}
