// public/redirect.js moves the old address to the real one and keeps the
// path, query and fragment. Loading the file in Node defines the function
// on globalThis and, with no window here, redirects nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../public/redirect.js";

const go = globalThis.canonicalSiteUrl;

test("the old pages.dev address goes to the new domain with everything kept", () => {
  assert.equal(go("sub-for-santa.pages.dev", "/refer.html", "", "#t=abc123"), "https://projectconnectionsanta.org/refer.html#t=abc123");
  assert.equal(go("sub-for-santa.pages.dev", "/queue", "?select=14", ""), "https://projectconnectionsanta.org/queue?select=14");
  assert.equal(go("sub-for-santa.pages.dev", "/", "", ""), "https://projectconnectionsanta.org/");
});

test("www goes to the bare domain", () => {
  assert.equal(go("www.projectconnectionsanta.org", "/browse", "", ""), "https://projectconnectionsanta.org/browse");
});

test("the real domain, the dev site, previews and localhost stay put", () => {
  assert.equal(go("projectconnectionsanta.org", "/", "", ""), null);
  assert.equal(go("dev.sub-for-santa.pages.dev", "/", "", ""), null);
  assert.equal(go("pr-12.sub-for-santa.pages.dev", "/", "", ""), null);
  assert.equal(go("localhost", "/", "", ""), null);
  assert.equal(go("127.0.0.1", "/", "", ""), null);
});
