// Sets a HOSTED Supabase project's sign-in settings from the command line,
// the same way the dashboard would, through Supabase's Management API.
//
// Why a script and not the dashboard: the settings for email sign-in are a
// dozen fields spread over three dashboard pages, two projects need the
// same values, and the email template is a file in this repo that should
// never be retyped. The script reads this repo's template, shows what it
// would change, and only writes when told to.
//
// It runs in the "Configure auth" GitHub workflow with the environment's
// own access token. Nothing here is a secret: the token, the Resend key and
// the project ref all arrive as environment variables.
//
// It is NOT `supabase config push`: it never reads supabase/config.toml and
// touches only the fields listed in desiredAuthConfig() below.
//
// Usage (the workflow sets these):
//   SUPABASE_ACCESS_TOKEN   personal access token (secret)
//   SUPABASE_PROJECT_REF    20-letter project ref
//   SITE_URL                https://… the site this project serves
//   RESEND_API_KEY          Resend API key, used as the SMTP password (secret)
//   SENDER_EMAIL            signin@example.com — on the domain verified in Resend
//   SENDER_NAME             "Sub for Santa"
//   GOOGLE                  "keep" (default) or "off"
//   CONFIRM                 "apply" to write; anything else is a dry run
import fs from "node:fs";
import path from "node:path";

const API = "https://api.supabase.com/v1";
const TEMPLATE = path.join(import.meta.dirname, "..", "supabase", "templates", "magic_link.html");
const SUBJECT = "Your Sub for Santa sign-in code: {{ .Token }}";

// The fields this script owns, and nothing else. Field names are the
// Management API's own (GET /v1/projects/{ref}/config/auth returns them).
export function desiredAuthConfig(input, template) {
  const required = ["siteUrl", "resendApiKey", "senderEmail", "senderName"];
  for (const key of required) {
    if (!input[key]) throw new Error(`Missing ${key}`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.senderEmail)) {
    throw new Error(`SENDER_EMAIL "${input.senderEmail}" does not look like an address`);
  }
  if (!/^https:\/\//.test(input.siteUrl)) {
    throw new Error(`SITE_URL must start with https:// (got "${input.siteUrl}")`);
  }
  if (!template.includes("{{ .Token }}")) {
    throw new Error("The email template must include {{ .Token }}, or nobody gets a code");
  }
  if (input.google !== "keep" && input.google !== "off") {
    throw new Error(`GOOGLE must be "keep" or "off" (got "${input.google}")`);
  }

  return {
    // Email sign-in on; new addresses may create an account (donors do).
    external_email_enabled: true,
    // No "confirm your address first" step: the code IS the confirmation.
    mailer_autoconfirm: true,
    // 6 digits, valid for 10 minutes, as the email says.
    mailer_otp_length: 6,
    mailer_otp_exp: 600,
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: template,
    // Resend over SMTP. The API key is the password.
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: input.resendApiKey,
    smtp_admin_email: input.senderEmail,
    smtp_sender_name: input.senderName,
    // One email per address per minute, 60 an hour per project. Plenty for
    // this drive; low enough that a typo in a loop can't burn the quota.
    smtp_max_frequency: 60,
    rate_limit_email_sent: 60,
    // Where the one-tap link lands.
    site_url: input.siteUrl,
    external_google_enabled: input.google === "keep",
  };
}

// Fields whose value the API never echoes back, so they can't be verified
// by reading the config again.
const SECRET_FIELDS = new Set(["smtp_pass"]);

function show(key, value) {
  if (SECRET_FIELDS.has(key)) return value ? "(set)" : "(empty)";
  if (typeof value === "string" && value.length > 60) return `${value.slice(0, 57)}… (${value.length} chars)`;
  return JSON.stringify(value);
}

async function api(method, ref, token, body) {
  const res = await fetch(`${API}/projects/${ref}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} config/auth → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !/^[a-z]{20}$/.test(ref || "")) {
    throw new Error("SUPABASE_ACCESS_TOKEN and a 20-letter SUPABASE_PROJECT_REF are required");
  }
  const template = fs.readFileSync(TEMPLATE, "utf8");
  const desired = desiredAuthConfig(
    {
      siteUrl: process.env.SITE_URL,
      resendApiKey: process.env.RESEND_API_KEY,
      senderEmail: process.env.SENDER_EMAIL,
      senderName: process.env.SENDER_NAME || "Sub for Santa",
      google: process.env.GOOGLE || "keep",
    },
    template,
  );

  console.log(`Project ${ref}: reading current auth settings…`);
  const before = await api("GET", ref, token);

  const changes = Object.keys(desired).filter((k) => !SECRET_FIELDS.has(k) && JSON.stringify(before[k]) !== JSON.stringify(desired[k]));
  console.log("");
  console.log(changes.length ? "Would change:" : "Every field already has the wanted value.");
  for (const k of changes) console.log(`  ${k}: ${show(k, before[k])} → ${show(k, desired[k])}`);
  console.log(`  smtp_pass: (always written; the API never shows it)`);
  console.log("");

  if (process.env.CONFIRM !== "apply") {
    console.log("Dry run. Re-run with confirm = apply to write these.");
    return;
  }

  console.log("Applying…");
  await api("PATCH", ref, token, desired);
  const after = await api("GET", ref, token);
  const wrong = Object.keys(desired).filter((k) => !SECRET_FIELDS.has(k) && JSON.stringify(after[k]) !== JSON.stringify(desired[k]));
  if (wrong.length) {
    for (const k of wrong) console.error(`  ${k}: wanted ${show(k, desired[k])}, project has ${show(k, after[k])}`);
    throw new Error(`${wrong.length} field(s) did not take. Nothing else was changed; check the names against the API.`);
  }
  console.log(`Done. ${changes.length} field(s) changed, all verified by reading the project back.`);
  console.log("Next: send yourself a code from the site and confirm it arrives (docs/environments.md, email §4).");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
