// The whole sign-in flow. Two ways in, and the page offers whichever the
// Supabase project has switched on (it asks the project, so nothing here
// has to change when a provider is turned on or off in the dashboard):
//
//   Email code  — type your address, get a 6-digit code by email, type it
//                 back. No password, no link to click, works when the email
//                 is read on a different device. The email also carries a
//                 one-tap link for people who prefer it.
//   Google      — the redirect flow, kept as a second option.
//
// Both end in the same Supabase session; everything after sign-in is
// identical. On a laptop the "email" goes to Mailpit, the fake inbox that
// `npm run dev` starts.
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
    root.appendChild(renderSignedOut(errorMessage));
  }
}

// Which ways in this project offers right now. /auth/v1/settings is public
// (it's how any client learns what the project supports) and reads the
// live dashboard setting, so turning email on or Google off takes effect
// on the next page load with no deploy. If the question can't be asked
// (offline), show both and let the attempt explain itself.
let methodsPromise;
function signInMethods() {
  methodsPromise ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((res) => res.json())
    .then((settings) => ({ email: settings.external?.email === true, google: settings.external?.google === true }))
    .catch(() => ({ email: true, google: true }));
  return methodsPromise;
}

// The address a code was sent to, while the person is typing it in.
let pendingEmail = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSignedOut(errorMessage) {
  const box = el("div", "stack");
  if (pendingEmail) {
    box.appendChild(renderCodeStep(pendingEmail));
    return box;
  }

  box.append(el("h2", null, "Sign in"));
  const intro = el("p", "muted", "Loading…");
  box.appendChild(intro);

  signInMethods().then((methods) => {
    intro.textContent = methods.email
      ? "We'll email you a 6-digit code. No password, nothing to install. Browsing needs no account; sponsoring a family does."
      : "Sponsors and the coordinator sign in with Google. Browsing needs no account; sponsoring a family does.";

    if (methods.email) box.appendChild(renderEmailForm());

    if (methods.google) {
      if (methods.email) box.appendChild(el("hr", "divider"));
      const googleButton = el("button", methods.email ? "btn btn-outline btn-block" : "btn btn-primary btn-block",
        methods.email ? "Continue with Google" : "Sign in with Google");
      googleButton.type = "button";
      googleButton.onclick = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            // With the trailing slash on purpose: Supabase matches this against
            // its redirect allow-list, and the "/**" pattern there does not
            // match a bare origin. Found on the first PR preview (2026-10-16).
            redirectTo: `${window.location.origin}/`,
            queryParams: { prompt: "select_account" },
          },
        });
        // Normally this never returns — the browser has left for Google. It
        // does return when no Google client is configured ("provider is not
        // enabled"), and that deserves a message, not silence.
        if (error) render(null, error.message);
      };
      box.appendChild(googleButton);
    }

    if (!methods.email && !methods.google) {
      box.appendChild(el("p", "notice notice-amber", "Sign-in isn't switched on for this site yet. The coordinator has been told."));
    }

    if (env === "local" && methods.email) {
      box.appendChild(el("p", "small muted", "Local: the email lands in Mailpit at http://127.0.0.1:54324, nowhere else."));
    }
  });

  return box;
}

// Step one: the address. Asking Supabase to send a code to an address that
// already has an account (one made with Google, say) signs that same
// account in — the user id doesn't change, so neither do their claims or
// the admin's role. A new address gets a new account, as before.
function renderEmailForm() {
  const form = el("form", "stack");
  form.id = "email-form";
  const label = el("label", "field");
  label.appendChild(el("span", null, "Your email"));
  const input = el("input");
  input.type = "email";
  input.name = "email";
  input.id = "email";
  input.required = true;
  input.autocomplete = "email";
  input.placeholder = "you@example.com";
  label.appendChild(input);
  const button = el("button", "btn btn-primary btn-block", "Email me a code");
  button.type = "submit";
  const status = el("p", "status-line");
  form.append(label, button, status);

  form.onsubmit = async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = "Sending…";
    const email = input.value.trim().toLowerCase();
    const { error } = await sendCode(email);
    if (error) {
      button.disabled = false;
      status.textContent = `Couldn't send the code: ${error.message}`;
      return;
    }
    pendingEmail = email;
    render(null);
  };
  return form;
}

function sendCode(email) {
  return supabase.auth.signInWithOtp({
    email,
    // The one-tap link in the same email comes back here, to the home page,
    // which is on the redirect allow-list (trailing slash, see above).
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
}

// Step two: the code. verifyOtp exchanges it for a session; the
// onAuthStateChange listener below then re-renders and sends the person
// back to the page they came from. The input invites the phone's
// one-time-code autofill so most people never type the six digits.
function renderCodeStep(email) {
  const form = el("form", "stack");
  form.id = "code-form";
  form.append(el("h2", null, "Check your email"));
  const intro = el("p", "muted");
  intro.append("We sent a 6-digit code to ");
  intro.appendChild(el("strong", null, email));
  intro.append(". Enter it here.");
  form.appendChild(intro);

  const label = el("label", "field");
  label.appendChild(el("span", null, "6-digit code"));
  const input = el("input");
  input.type = "text";
  input.name = "code";
  input.id = "code";
  input.inputMode = "numeric";
  input.autocomplete = "one-time-code";
  input.pattern = "[0-9]{6}";
  input.maxLength = 6;
  input.required = true;
  input.placeholder = "123456";
  label.appendChild(input);
  const button = el("button", "btn btn-primary btn-block", "Sign in");
  button.type = "submit";
  const status = el("p", "status-line");

  const again = el("p", "small muted");
  const resend = el("button", "link-button", "Send a new code");
  resend.type = "button";
  const other = el("button", "link-button", "Use a different email");
  other.type = "button";
  again.append("Didn't get it? Check spam, or ", resend, ". Wrong address? ", other, ".");

  form.append(label, button, status, again);

  // Supabase refuses a second email within a minute, so count that down on
  // the button rather than let people hit a cryptic rate-limit error.
  let wait = 60;
  resend.disabled = true;
  const label0 = resend.textContent;
  const tick = setInterval(() => {
    wait -= 1;
    resend.textContent = wait > 0 ? `${label0} in ${wait}s` : label0;
    if (wait <= 0) { resend.disabled = false; clearInterval(tick); }
  }, 1000);
  resend.textContent = `${label0} in ${wait}s`;

  resend.onclick = async () => {
    resend.disabled = true;
    status.textContent = "Sending a new code…";
    const { error } = await sendCode(email);
    status.textContent = error ? `Couldn't send a new code: ${error.message}` : "Sent. The newest code is the one that works.";
    if (!error) { wait = 60; resend.textContent = `${label0} in ${wait}s`; }
    else resend.disabled = false;
  };
  other.onclick = () => { clearInterval(tick); pendingEmail = null; render(null); };

  form.onsubmit = async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = "Checking…";
    const { error } = await supabase.auth.verifyOtp({ email, token: input.value.trim(), type: "email" });
    if (error) {
      button.disabled = false;
      status.textContent = `That code didn't work: ${error.message}. Codes expire after 10 minutes.`;
      input.select();
      return;
    }
    clearInterval(tick);
    pendingEmail = null;
    // onAuthStateChange("SIGNED_IN") takes it from here.
  };

  setTimeout(() => input.focus(), 0);
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
