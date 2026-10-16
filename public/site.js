// The public header's right-hand links, decided by who is signed in:
//
//   nobody        Browse families · Sign in
//   a donor       Browse families · My families · Sign out
//   the admin     Browse families · Coordinator console · Sign out
//
// This is navigation, not security. The admin's console pages return
// nothing to anyone else whatever link they follow; a donor's page returns
// only their own claims. RLS decides all of that, not this file.
import { supabase } from "./auth.js";

const nav = document.getElementById("site-nav");
const current = window.location.pathname;

function link(href, label) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  if (current === href) a.setAttribute("aria-current", "page");
  return a;
}

async function render() {
  if (!nav) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  nav.innerHTML = "";
  nav.appendChild(link("/browse.html", "Browse families"));

  if (!session) {
    nav.appendChild(link("/signin.html", "Sign in"));
    return;
  }

  // The admin's own profile row is readable by the admin only.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  if (profile?.role === "admin") {
    nav.appendChild(link("/dashboard.html", "Coordinator console"));
  } else {
    nav.appendChild(link("/mine.html", "My families"));
  }

  const signOut = document.createElement("a");
  signOut.href = "#";
  signOut.textContent = "Sign out";
  signOut.onclick = async (event) => {
    event.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "/";
  };
  nav.appendChild(signOut);
}

await render();
