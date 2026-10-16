// The whole sign-in flow: start the Google redirect, read the session back
// on return, end the session on sign out. On a local database only, there
// is a second way in — an emailed link that lands in Mailpit — because a
// fresh clone has no Google OAuth client to use. Both paths end in the same
// Supabase session; everything after sign-in is identical.
//
// The CDN import is pinned to an exact version. A floating "@2" would let a
// new release change what runs on the live site without a commit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { SUPABASE_URL, SUPABASE_ANON_KEY, env } from "./config.js";

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
    message.className = "notice notice-red";
    message.textContent = `Sign-in failed: ${errorMessage}`;
    root.appendChild(message);
  }

  if (session) {
    const title = document.createElement("h2");
    title.textContent = "You're signed in";
    const whoami = document.createElement("p");
    whoami.className = "muted";
    whoami.textContent = session.user.email;
    // Where to next depends on who this is. The admin's own profile row is
    // readable by the admin only, so everyone else reads nothing and gets
    // the donor link. Navigation, not security: RLS decides what each page
    // actually shows (CLAUDE.md).
    const nextLink = document.createElement("a");
    nextLink.className = "btn btn-green btn-block";
    nextLink.href = "/browse.html";
    nextLink.textContent = "Browse families";
    supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (data?.role === "admin") {
        nextLink.href = "/dashboard.html";
        nextLink.textContent = "Open the coordinator console";
      }
    });
    const signOutButton = document.createElement("button");
    signOutButton.className = "btn btn-outline btn-block";
    signOutButton.textContent = "Sign out";
    signOutButton.onclick = () => supabase.auth.signOut();
    root.append(title, whoami, nextLink, signOutButton);
  } else {
    const title = document.createElement("h2");
    title.textContent = "Sign in";
    const intro = document.createElement("p");
    intro.className = "muted";
    intro.textContent = "Sponsors and the coordinator sign in with Google. Browsing needs no account; claiming a family does.";
    const signInButton = document.createElement("button");
    signInButton.className = "btn btn-primary btn-block";
    signInButton.textContent = "Sign in with Google";
    signInButton.onclick = async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" },
        },
      });
      // Normally this never returns — the browser has left for Google. It
      // does return on a local database with no Google client configured
      // ("provider is not enabled"), and that deserves a message, not silence.
      if (error) render(null, error.message);
    };
    root.append(title, intro, signInButton);

    // Local only. config.js says "local" exactly when the page is talking to
    // the Docker database on this machine. On the hosted projects the email
    // provider is switched off, so this form would fail there anyway — the
    // gate keeps it from even appearing.
    if (env === "local") {
      const divider = document.createElement("hr");
      divider.className = "divider";
      root.append(divider, renderLocalEmailForm());
    }
  }
}

// A magic link, for the local database only. Supabase "sends" the email to
// Mailpit, a fake inbox running in Docker; nothing leaves the machine.
// Clicking the link in Mailpit brings the browser back here signed in.
function renderLocalEmailForm() {
  const form = document.createElement("form");
  form.className = "notice notice-amber";
  const label = document.createElement("label");
  label.className = "field";
  const labelText = document.createElement("span");
  labelText.textContent = "Local only — sign in by email";
  label.appendChild(labelText);
  const input = document.createElement("input");
  input.type = "email";
  input.name = "email";
  input.required = true;
  input.placeholder = "you@example.test";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "btn btn-outline";
  button.textContent = "Email me a sign-in link";
  const status = document.createElement("p");
  status.className = "status-line";
  label.appendChild(input);
  form.append(label, button, status);

  form.onsubmit = async (event) => {
    event.preventDefault();
    status.textContent = "Sending…";
    const { error } = await supabase.auth.signInWithOtp({
      email: input.value,
      options: { emailRedirectTo: window.location.origin },
    });
    status.textContent = error
      ? `Couldn't send the link: ${error.message}`
      : "Sent. Open Mailpit at http://127.0.0.1:54324 and click the link.";
  };

  return form;
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
  continueAfterSignIn(data.session);
}

// A page that needed a sign-in (the story page, before claiming) leaves
// where to go back to in sessionStorage. Once a session exists, go there.
// Only a path on this site is honoured, never a full URL.
function continueAfterSignIn(session) {
  if (!session) return;
  const next = sessionStorage.getItem("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    sessionStorage.removeItem("next");
    window.location.href = next;
  }
}

// Strip error/token params from the address bar so a reload doesn't replay
// a stale error and tokens don't linger visibly in the URL. Only when the
// URL actually carried sign-in parameters: other pages use the query
// string for their own purposes (queue.html?select=…), and those stay.
if (/(^|[?#&])(error|error_description|access_token|refresh_token|code|type)=/.test(window.location.search + window.location.hash)) {
  history.replaceState(null, "", window.location.pathname);
}

// Keeps the page in sync once sign-in finishes and on every sign-out — no
// manual reload or re-render call needed. Skip the "INITIAL_SESSION" event:
// that one fires immediately on subscribing, with whatever session already
// exists right now, which we've already rendered above. Without this skip,
// it fires with session=null right after a failed sign-in and wipes out
// the error message just shown.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION") return;
  render(session);
  if (event === "SIGNED_IN") continueAfterSignIn(session);
});
