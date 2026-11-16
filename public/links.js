// Referral links: the admin makes one, copies it, and sees the ones made
// before with their state. The token comes back from the database exactly
// once, goes into the link shown on this page, and is never fetched again
// — the table only holds its hash.
//
// The token rides in the URL *fragment* (#t=…), not the path or query
// string. Browsers never send the fragment to a server, so it stays out of
// Cloudflare's request logs and out of our own server.js log line.
import { supabase } from "./auth.js";
import { mountConsole, requireSession } from "./console.js";

const root = document.getElementById("links-root");
const createButton = document.getElementById("create-link");
const createStatus = document.getElementById("create-status");
const newLink = document.getElementById("new-link");
const newLinkUrl = document.getElementById("new-link-url");
const newLinkExpiry = document.getElementById("new-link-expiry");
const copyButton = document.getElementById("copy-link");
const list = document.getElementById("links-list");

function linkFor(token) {
  return `${window.location.origin}/refer.html#t=${token}`;
}

// "Closed" is a person's decision; "Expired" is the date arriving. The
// page tells them apart so a stopped link stays visibly stopped.
function stateOf(link) {
  if (link.uses >= link.max_uses) return { label: "Used up", pill: "pill-grey" };
  if (link.closed_at) return { label: `Closed ${new Date(link.closed_at).toLocaleDateString()}`, pill: "pill-rejected" };
  if (new Date(link.expires_at) < new Date()) return { label: "Expired", pill: "pill-rejected" };
  return { label: "Usable", pill: "pill-live", usable: true };
}

// Stops a link today. The database does the real work — it refuses anyone
// but the admin and a link that is already finished — and moves the expiry
// into the past, which every check already honours. Nothing is deleted:
// the row stays so the referrals that came through it keep their link.
async function expireNow(link, button) {
  const made = new Date(link.created_at).toLocaleString();
  const sure = window.confirm(
    `Expire this link now?\n\nMade ${made}, used ${link.uses} of ${link.max_uses}.\n` +
    `Nobody will be able to submit through it after this. It can't be undone.`,
  );
  if (!sure) return;

  button.disabled = true;
  button.textContent = "Expiring…";
  const { error } = await supabase.rpc("expire_referral_link", { p_id: link.id });
  if (error) {
    button.disabled = false;
    button.textContent = "Expire now";
    window.alert(`Couldn't expire the link: ${error.message}`);
    return;
  }
  await loadLinks();
}

function renderList(links) {
  list.innerHTML = "";
  if (links.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No links yet.";
    list.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "table";
  const head = table.createTHead().insertRow();
  for (const label of ["Created", "Expires", "Uses", "State", "Referrals", ""]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    head.appendChild(cell);
  }
  const body = table.createTBody();
  for (const link of links) {
    const row = body.insertRow();
    // The first few characters of the id, so two links made the same day
    // can be told apart over the phone. Not a secret: the token is never
    // stored, and the id opens nothing.
    const created = row.insertCell();
    created.textContent = new Date(link.created_at).toLocaleString();
    const short = document.createElement("span");
    short.className = "small muted";
    short.textContent = ` · ${link.id.slice(0, 8)}`;
    created.appendChild(short);
    row.insertCell().textContent = new Date(link.expires_at).toLocaleString();
    row.insertCell().textContent = `${link.uses} of ${link.max_uses}`;
    const state = stateOf(link);
    const pill = document.createElement("span");
    pill.className = `pill ${state.pill}`;
    pill.textContent = state.label;
    row.insertCell().appendChild(pill);
    // Which referrals came through it — by ref code, the only handle a
    // household ever has.
    const codes = (link.households ?? []).map((h) => h.ref_code);
    row.insertCell().textContent = codes.length ? codes.join(", ") : "—";

    const actions = row.insertCell();
    if (state.usable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-outline btn-sm";
      button.textContent = "Expire now";
      button.onclick = () => expireNow(link, button);
      actions.appendChild(button);
    }
  }
  list.appendChild(table);
}

async function loadLinks() {
  const { data, error } = await supabase
    .from("referral_links")
    .select("id, created_at, expires_at, closed_at, uses, max_uses, households ( ref_code )")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "";
    const message = document.createElement("p");
    message.className = "notice notice-red";
    message.textContent = `Couldn't load the links: ${error.message}`;
    list.appendChild(message);
    return;
  }
  renderList(data);
}

createButton.onclick = async () => {
  createButton.disabled = true;
  createStatus.textContent = "Creating…";

  // The function refuses anyone but the admin; the page does not pre-check.
  const maxUses = Math.min(1000, Math.max(1, Number(document.getElementById("max-uses").value) || 1));
  const expiresDays = Math.min(90, Math.max(1, Number(document.getElementById("expires-days").value) || 7));
  const { data, error } = await supabase.rpc("create_referral_link", { p_max_uses: maxUses, p_expires_days: expiresDays });

  createButton.disabled = false;
  if (error) {
    createStatus.textContent = `Couldn't create a link: ${error.message}`;
    return;
  }

  const made = Array.isArray(data) ? data[0] : data;
  createStatus.textContent = "";
  newLinkUrl.value = linkFor(made.token);
  newLinkExpiry.textContent = `Expires ${new Date(made.expires_at).toLocaleString()} · ${made.max_uses === 1 ? "one household" : `up to ${made.max_uses} households`}.`;
  newLink.classList.remove("hidden");
  await loadLinks();
};

copyButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(newLinkUrl.value);
    copyButton.textContent = "Copied";
  } catch {
    // Clipboard access can be refused (older browsers, some permissions);
    // selecting the text is the fallback, and Ctrl/Cmd-C does the rest.
    newLinkUrl.select();
    copyButton.textContent = "Press Ctrl/Cmd-C to copy";
  }
  setTimeout(() => {
    copyButton.textContent = "Copy link";
  }, 2500);
};

mountConsole({ title: "Referral links" });
const session = await requireSession(root);
if (session) await loadLinks();
