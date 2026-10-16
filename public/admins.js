// Admins: who holds the coordinator role, and the invites waiting to be
// claimed. Every change goes through a function that insists the caller is
// an admin; the page just shows what list_admins() returns.
import { supabase } from "./auth.js";
import { mountConsole, requireSession } from "./console.js";

const root = document.getElementById("admins-root");
const adminsRoot = document.getElementById("admins");
const invitesRoot = document.getElementById("invites");
const form = document.getElementById("add-form");
const emailInput = document.getElementById("add-email");
const addStatus = document.getElementById("add-status");

let me = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function when(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Remove and Revoke are two clicks, no dialog: the second button names
// the address so there is no doubt what is about to happen.
function twoStep(container, label, confirmLabel, action) {
  const start = el("button", "btn btn-danger btn-sm", label);
  start.type = "button";
  const confirm = el("button", "btn btn-danger btn-sm hidden", confirmLabel);
  confirm.type = "button";
  const cancel = el("button", "btn btn-outline btn-sm hidden", "Keep");
  cancel.type = "button";
  start.onclick = () => {
    start.classList.add("hidden");
    confirm.classList.remove("hidden");
    cancel.classList.remove("hidden");
  };
  cancel.onclick = () => load();
  confirm.onclick = action;
  container.append(start, confirm, cancel);
}

function renderAdmins(rows) {
  adminsRoot.innerHTML = "";
  const list = el("ul", "row-list");
  for (const row of rows) {
    const item = el("li");
    const text = el("span");
    text.append(el("strong", null, row.email), row.id === me ? el("span", "pill pill-live", " you") : "", el("br"), el("span", "meta", `admin since ${when(row.since)}`));
    const actions = el("div", "actions");
    if (rows.length === 1) {
      actions.appendChild(el("span", "muted small", "the only admin — add another before removing"));
    } else {
      twoStep(actions, row.id === me ? "Remove myself" : "Remove", `Yes, remove ${row.email}`, async () => {
        const { error } = await supabase.rpc("remove_admin", { p_user_id: row.id });
        if (error) {
          adminsRoot.prepend(el("p", "notice notice-red small", error.message));
          return;
        }
        if (row.id === me) {
          // No longer an admin: the console will show nothing. Go home.
          window.location.href = "/";
          return;
        }
        await load();
      });
    }
    item.append(text, actions);
    list.appendChild(item);
  }
  adminsRoot.appendChild(list);
}

function renderInvites(rows) {
  invitesRoot.innerHTML = "";
  if (!rows.length) {
    invitesRoot.appendChild(el("p", "empty", "No pending invites."));
    return;
  }
  const list = el("ul", "row-list");
  for (const row of rows) {
    const item = el("li");
    const text = el("span");
    text.append(el("strong", null, row.email), el("br"), el("span", "meta", `invited ${when(row.since)} · becomes an admin on first sign-in`));
    const actions = el("div", "actions");
    twoStep(actions, "Revoke", `Yes, revoke ${row.email}`, async () => {
      const { error } = await supabase.rpc("revoke_invite", { p_email: row.email });
      if (error) invitesRoot.prepend(el("p", "notice notice-red small", error.message));
      await load();
    });
    item.append(text, actions);
    list.appendChild(item);
  }
  invitesRoot.appendChild(list);
}

form.onsubmit = async (event) => {
  event.preventDefault();
  addStatus.textContent = "Adding…";
  const { data, error } = await supabase.rpc("add_admin", { p_email: emailInput.value });
  if (error) {
    addStatus.textContent = error.message;
    return;
  }
  addStatus.textContent = data === "added"
    ? `${emailInput.value.trim()} is an admin now.`
    : `${emailInput.value.trim()} will become an admin when they first sign in.`;
  emailInput.value = "";
  await load();
};

async function load() {
  const { data, error } = await supabase.rpc("list_admins");
  if (error) {
    root.innerHTML = "";
    root.appendChild(el("p", "notice notice-red", error.code === "42501" ? "Only an admin can see this page." : error.message));
    return;
  }
  renderAdmins(data.filter((r) => r.kind === "admin"));
  renderInvites(data.filter((r) => r.kind === "invite"));
}

mountConsole({ title: "Admins" });
const session = await requireSession(root);
if (session) {
  me = session.user.id;
  await load();
}
