// Proves the hostname → environment rule in public/config.js, especially
// the part that matters: nothing but the exact prod hostname reaches prod.
// Run with `npm test` (node --test). No browser, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTarget } from "../public/config.js";

const PROD = "sub-for-santa.pages.dev"; // stand-in; the real value lives in config.js

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
