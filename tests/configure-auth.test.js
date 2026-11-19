// The pure part of scripts/configure-auth.js: given the inputs and the
// template, which settings does it want? No network here; the workflow does
// the talking to Supabase.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { desiredAuthConfig } from "../scripts/configure-auth.js";

const template = fs.readFileSync(path.join(import.meta.dirname, "..", "supabase", "templates", "magic_link.html"), "utf8");
const good = { siteUrl: "https://sub-for-santa.pages.dev", resendApiKey: "re_test_key", senderEmail: "signin@example.com", senderName: "Sub for Santa", google: "keep" };

test("the real template carries the code and nothing a spam filter dislikes", () => {
  assert.match(template, /\{\{ \.Token \}\}/);
  // No links: a link to a domain other than the sender's got the first
  // version filed as spam (2026-11-19). The page signs in by code.
  assert.doesNotMatch(template, /<a\s|href=|https?:\/\//i, "no links in the sign-in email");
  assert.doesNotMatch(template, /<script|<img/i, "no scripts or images in a sign-in email");
});

test("email on, confirmations off, 6-digit codes for 10 minutes, Resend as SMTP", () => {
  const c = desiredAuthConfig(good, template);
  assert.equal(c.external_email_enabled, true);
  assert.equal(c.mailer_autoconfirm, true);
  assert.equal(c.mailer_otp_length, 6);
  assert.equal(c.mailer_otp_exp, 600);
  assert.equal(c.smtp_host, "smtp.resend.com");
  assert.equal(c.smtp_user, "resend");
  assert.equal(c.smtp_pass, "re_test_key");
  assert.equal(c.smtp_admin_email, "signin@example.com");
  assert.equal(c.smtp_sender_name, "Sub for Santa");
  assert.equal(c.mailer_templates_magic_link_content, template);
  assert.match(c.mailer_subjects_magic_link, /\{\{ \.Token \}\}/, "the code is in the subject line");
  assert.equal(c.site_url, "https://sub-for-santa.pages.dev");
});

test("google stays on with keep and goes off with off", () => {
  assert.equal(desiredAuthConfig({ ...good, google: "keep" }, template).external_google_enabled, true);
  assert.equal(desiredAuthConfig({ ...good, google: "off" }, template).external_google_enabled, false);
  assert.throws(() => desiredAuthConfig({ ...good, google: "maybe" }, template), /GOOGLE/);
});

test("refuses to run with a missing key, a bad sender, an http site, or a template without the code", () => {
  assert.throws(() => desiredAuthConfig({ ...good, resendApiKey: "" }, template), /resendApiKey/);
  assert.throws(() => desiredAuthConfig({ ...good, senderEmail: "not-an-address" }, template), /SENDER_EMAIL/);
  assert.throws(() => desiredAuthConfig({ ...good, siteUrl: "http://example.com" }, template), /https/);
  assert.throws(() => desiredAuthConfig(good, "<p>hello</p>"), /Token/);
});

test("it touches only the fields it names — no config.toml-wide push", () => {
  const keys = Object.keys(desiredAuthConfig(good, template)).sort();
  assert.deepEqual(keys, [
    "external_email_enabled", "external_google_enabled",
    "mailer_autoconfirm", "mailer_otp_exp", "mailer_otp_length",
    "mailer_subjects_magic_link", "mailer_templates_magic_link_content",
    "rate_limit_email_sent", "site_url",
    "smtp_admin_email", "smtp_host", "smtp_max_frequency", "smtp_pass", "smtp_port", "smtp_sender_name", "smtp_user",
  ]);
});
