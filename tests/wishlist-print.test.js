// The printed wish list must never carry anything that identifies a family:
// no first name, no provider, no client name, no household email or phone,
// nothing from the coordinator's note. Paper is outside the Feb 12 purge
// and outside RLS, so this is a deletion rule as much as a privacy one
// (product Story #19, criterion 5).
//
// The protection is an allow-list: renderWishList is handed named values,
// never a whole database row, and the dashboard fetches members and wish
// items by named columns. These tests read the source — the same way
// dashboard-csv.test.js checks the CSV export — and fail if that list
// grows, or if anything identifying is mentioned where the page is built.
// A failure here is a prompt to stop and decide, not a test to "fix".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(import.meta.dirname, "..", "public");
const printSource = fs.readFileSync(path.join(PUBLIC, "wishlist-print.js"), "utf8");
const dashboardSource = fs.readFileSync(path.join(PUBLIC, "dashboard.js"), "utf8");
const confirmedSource = fs.readFileSync(path.join(PUBLIC, "confirmed.js"), "utf8");

// Every column that identifies a household or holds a private note:
// household_contacts' columns, plus households.family_note,
// households.admin_note (the coordinator's own note) and
// households.submitter_label. coordinator_note is the referral form's
// name for the note.
const IDENTIFYING = [
  "household_contacts",
  "household_first_name",
  "submitter_first_name",
  "referral_source",
  "client_name",
  "primary_channel",
  "contact_is",
  "family_note",
  "admin_note",
  "coordinator_note",
  "submitter_label",
];

const squash = (text) => text.replace(/\s+/g, " ").trim();

function printFamilyBlock() {
  const start = dashboardSource.indexOf("async function printFamily(");
  assert.ok(start !== -1, "expected dashboard.js to define printFamily");
  const end = dashboardSource.indexOf("\n}\n", start);
  return dashboardSource.slice(start, end);
}

// The argument object of the first `name({ ... })` call in `source`.
function callArgument(source, name) {
  const match = source.match(new RegExp(`${name}\\((\\{[^}]*\\})`));
  assert.ok(match, `expected a call to ${name}({ ... })`);
  return squash(match[1]);
}

test("renderWishList accepts exactly these named values, and nothing else", () => {
  const match = printSource.match(/export function renderWishList\(\{([^}]*)\}\)/);
  assert.ok(match, "expected wishlist-print.js to export renderWishList({ ... })");
  assert.equal(squash(match[1]), 'refCode, members, items, drop, copy = "donor", summary');
});

test("the printed page mentions no identifying field", () => {
  for (const field of IDENTIFYING) {
    assert.ok(!printSource.includes(field), `wishlist-print.js must not reference ${field}`);
  }
  // contact_email and contact_phone are the coordinator's own line in the
  // footer and are fine. A bare `email` or `phone` would be someone else's.
  assert.doesNotMatch(printSource, /\bemail\b/, "wishlist-print.js must not reference a bare email");
  assert.doesNotMatch(printSource, /\bphone\b/, "wishlist-print.js must not reference a bare phone");
});

test("the Print button copies three named fields out of the roster row, never the row", () => {
  assert.equal(callArgument(dashboardSource, "printFamily"), "{ id: h.id, refCode: h.ref_code, summary: h.summary }");
  assert.equal((dashboardSource.match(/printFamily\(/g) ?? []).length, 2, "expected one definition and one call of printFamily");
});

test("the dashboard hands renderWishList named values only", () => {
  assert.equal(
    callArgument(printFamilyBlock(), "renderWishList"),
    '{ refCode: family.refCode, members, items, drop, copy: "coordinator", summary: family.summary }',
  );
});

test("the dashboard fetches members and wish items by named columns", () => {
  const block = printFamilyBlock();
  const members = block.match(/\.from\("household_members"\)\s*\.select\("([^"]*)"\)/);
  const items = block.match(/\.from\("wish_items"\)\s*\.select\("([^"]*)"\)/);
  assert.ok(members && items, "expected printFamily to select from household_members and wish_items");
  assert.equal(members[1], "id, role, age, clothing_size, shoe_size");
  assert.equal(items[1], "member_id, kind, label");
});

test("the dashboard's print code mentions no identifying field and logs nothing", () => {
  const block = printFamilyBlock();
  for (const field of [...IDENTIFYING, "contactOf", "console."]) {
    assert.ok(!block.includes(field), `printFamily must not reference ${field}`);
  }
  assert.doesNotMatch(block, /\bemail\b|\bphone\b/, "printFamily must not reference an email or phone");
});

test("only approved families get a Print button", () => {
  assert.match(dashboardSource, /const PRINTABLE = new Set\(\["live", "sponsored", "delivered"\]\);/);
  assert.match(
    dashboardSource,
    /if \(PRINTABLE\.has\(shownStatus\(h\)\)\) \{\s*const print = el\("button"/,
    "the Print button must be created only inside the PRINTABLE check",
  );
});

test("the donor's confirmation page hands over named values, never the claim row", () => {
  assert.equal(callArgument(confirmedSource, "renderWishList"), "{ refCode: claim.ref_code, members, items, drop }");
});
