// The whole sign-in-with-Google flow: start the redirect, read the session
// back on return, end the session on sign out. No table and no RLS yet —
// there is nothing to protect. Access control right now is Google's
// test-user list, not this app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.getElementById("auth-root");

function render(session, errorMessage) {
  // Pages other than index.html (queue.html, importing supabase from here)
  // have no #auth-root at all — nothing to draw into, so do nothing rather
  // than crash on a null element.
  if (!root) return;

  root.innerHTML = "";

  if (errorMessage) {
    const message = document.createElement("p");
    message.textContent = `Sign-in failed: ${errorMessage}`;
    root.appendChild(message);
  }

  if (session) {
    const whoami = document.createElement("p");
    whoami.textContent = `Signed in as ${session.user.email}`;
    const signOutButton = document.createElement("button");
    signOutButton.textContent = "Sign out";
    signOutButton.onclick = () => supabase.auth.signOut();
    root.append(whoami, signOutButton);
  } else {
    const signInButton = document.createElement("button");
    signInButton.textContent = "Sign in with Google";
    signInButton.onclick = () =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" },
        },
      });
    root.appendChild(signInButton);
  }
}

// Google/Supabase send the user back with an error in the URL (denied
// consent, a misconfigured redirect URI) instead of a session. Catch that
// before asking Supabase anything, so a failed round-trip shows an error
// instead of quietly looking like signed-out. Checked as both query string
// and hash fragment since either can carry it depending on the failure.
function readUrlError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return (
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error")
  );
}

const urlError = readUrlError();

if (urlError) {
  render(null, urlError);
} else {
  const { data } = await supabase.auth.getSession();
  render(data.session);
}

// Strip error/token params from the address bar so a reload doesn't replay
// a stale error and tokens don't linger visibly in the URL.
history.replaceState(null, "", window.location.pathname);

// Keeps the page in sync once sign-in finishes and on every sign-out — no
// manual reload or re-render call needed. Skip the "INITIAL_SESSION" event:
// that one fires immediately on subscribing, with whatever session already
// exists right now, which we've already rendered above. Without this skip,
// it fires with session=null right after a failed sign-in and wipes out
// the error message just shown.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION") return;
  render(session);
});
