// Shared chrome for every coordinator page: the sidebar list of pages, the
// top bar, and the "sign in first" card. The list of pages lives here and
// nowhere else, so adding a console page is one line in PAGES plus the
// page itself.
//
// None of this is security. A page that is not the admin's still loads; it
// just gets nothing back from the database, because RLS decides who reads
// what (CLAUDE.md, "page-level access checks are UX, not security").
import { supabase } from "./auth.js";
import { env } from "./config.js";
import { samePage } from "./paths.js";

export const PAGES = [
  { href: "/dashboard.html", label: "Dashboard" },
  { href: "/queue.html", label: "Approval queue", badge: "pending" },
  { href: "/links.html", label: "Referral links" },
  { href: "/exceptions.html", label: "Exceptions" },
  { href: "/settings.html", label: "Drive settings" },
];

const badges = {};

// Fills the sidebar and the top bar. Call once, at the top of the page.
export function mountConsole({ title }) {
  const list = document.getElementById("console-pages");
  const heading = document.getElementById("page-title");
  if (heading) heading.textContent = title;
  if (!list) return;

  list.innerHTML = "";
  for (const page of PAGES) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = page.href;
    link.textContent = page.label;
    if (samePage(window.location.pathname, page.href)) {
      link.setAttribute("aria-current", "page");
    }
    if (page.badge) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badges[page.badge] = badge;
      link.append(" ", badge);
    }
    item.appendChild(link);
    list.appendChild(item);
  }
}

// A number next to a sidebar entry, or nothing when it is zero.
export function setBadge(name, count) {
  const badge = badges[name];
  if (badge) badge.textContent = count ? String(count) : "";
}

// Returns the session, or renders the sign-in card into `root` and returns
// null. The sandbox pill names which database the page is talking to; it
// never renders on the live site, where there is nothing to warn about.
export async function requireSession(root) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) {
    root.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card auth-card";
    const message = document.createElement("p");
    message.textContent = "Sign in to open the coordinator console.";
    const link = document.createElement("a");
    link.href = "/";
    link.className = "btn btn-primary";
    link.textContent = "Sign in";
    card.append(message, link);
    root.appendChild(card);
    return null;
  }

  const whoami = document.getElementById("whoami");
  if (whoami) whoami.textContent = session.user.email;

  const envPill = document.getElementById("env-pill");
  if (envPill && env !== "prod") {
    envPill.textContent = env === "local" ? "Local database" : "Sandbox data";
    envPill.classList.remove("hidden");
  }

  return session;
}

// One place that knows how a date column (YYYY-MM-DD) reads on screen.
export function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
