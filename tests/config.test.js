// Proves the hostname → environment rule in public/config.js, especially
// the part that matters: nothing but the exact prod hostname reaches prod.
// Run with `npm test` (node --test). No browser, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTarget, PROD_HOSTNAME } from "../public/config.js";

// Most tests pass the prod hostname in explicitly so they read clearly; the
// last one checks the real constant from config.js.
const PROD = "sub-for-santa.pages.dev";

test("localhost and 127.0.0.1 resolve to local", () => {
  assert.equal(pickTarget("localhost", undefined, PROD), "local");
  assert.equal(pickTarget("127.0.0.1", undefined, PROD), "local");
});

test("the SUPABASE_TARGET=dev escape hatch sends localhost to dev", () => {
  assert.equal(pickTarget("localhost", "dev", PROD), "dev");
  assert.equal(pickTarget("127.0.0.1", "dev", PROD), "dev");
});

test("the escape hatch can only ever say dev, never prod", () => {
  assert.equal(pickTarget("localhost", "prod", PROD), "local");
  assert.equal(pickTarget("localhost", "anything-else", PROD), "local");
});

test("only the exact prod hostname resolves to prod", () => {
  assert.equal(pickTarget(PROD, undefined, PROD), "prod");
});

test("everything near prod, but not prod, resolves to dev", () => {
  assert.equal(pickTarget(`${PROD}.evil.example`, undefined, PROD), "dev");
  assert.equal(pickTarget(`www.${PROD}`, undefined, PROD), "dev");
  assert.equal(pickTarget(`pr-12.${PROD}`, undefined, PROD), "dev");
  assert.equal(pickTarget("dev.sub-for-santa.pages.dev", undefined, PROD), "dev");
});

test("unknown hosts, empty hosts and missing hosts resolve to dev", () => {
  assert.equal(pickTarget("example.com", undefined, PROD), "dev");
  assert.equal(pickTarget("", undefined, PROD), "dev");
  assert.equal(pickTarget(undefined, undefined, PROD), "dev");
});

test("while the prod hostname is unset, nothing resolves to prod", () => {
  assert.equal(pickTarget("sub-for-santa.pages.dev", undefined, null), "dev");
  assert.equal(pickTarget("null", undefined, null), "dev");
});

test("the real PROD_HOSTNAME is set, exact, and the only way to prod", () => {
  assert.equal(typeof PROD_HOSTNAME, "string");
  assert.equal(pickTarget(PROD_HOSTNAME), "prod");
  assert.equal(pickTarget(`dev.${PROD_HOSTNAME}`), "dev");
  assert.equal(pickTarget(`pr-7.${PROD_HOSTNAME}`), "dev");
  assert.equal(pickTarget(`${PROD_HOSTNAME}.example.com`), "dev");
  assert.equal(pickTarget(PROD_HOSTNAME.toUpperCase()), "dev"); // browsers lowercase hostnames; anything else isn't one
});

// paths.js must treat Cloudflare's clean URLs and the local server's .html
// paths as the same page.
import { samePage } from "../public/paths.js";

test("samePage matches clean URLs against .html links and vice versa", () => {
  assert.equal(samePage("/queue", "/queue.html"), true);
  assert.equal(samePage("/queue.html", "/queue.html"), true);
  assert.equal(samePage("/", "/index.html"), true);
  assert.equal(samePage("/browse", "/story.html"), false);
});
