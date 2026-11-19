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

// The text of a top-level function in dashboard.js, from its first line
// to the closing brace at the start of a line.
function functionBlock(name) {
  const start = dashboardSource.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(start !== -1, `expected dashboard.js to define ${name}`);
  const end = dashboardSource.indexOf("\n}\n", start);
  return dashboardSource.slice(start, end);
}

const printFamiliesBlock = () => functionBlock("printFamilies");

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

test("every print button hands over household ids, never a roster row", () => {
  // The definition's parameter, the roster row's button, the picker.
  const allowed = new Set(["ids", "[h.id]", "[...selected]"]);
  const calls = [...dashboardSource.matchAll(/printFamilies\(([^,)]*)/g)].map((m) => m[1].trim());
  assert.ok(calls.includes("[h.id]"), "expected the roster's Print button to call printFamilies([h.id], …)");
  for (const argument of calls) {
    assert.ok(allowed.has(argument), `printFamilies must be handed ids, got: ${argument}`);
  }
});

test("the dashboard hands renderWishList named values only", () => {
  assert.equal(
    callArgument(printFamiliesBlock(), "renderWishList"),
    "{ refCode: family.refCode, members: members.filter((m) => m.household_id === family.id), " +
      "items: items.filter((i) => i.household_id === family.id), drop, " +
      'copy: "coordinator", summary: family.summary, }',
  );
});

test("the print path reads households, members and wish items by named columns", () => {
  const block = printFamiliesBlock();
  const select = (table) => block.match(new RegExp(`\\.from\\("${table}"\\)\\s*\\.select\\("([^"]*)"\\)`))?.[1];
  assert.equal(select("households"), "id, ref_code, summary, status");
  assert.equal(select("household_members"), "id, household_id, role, age, clothing_size, shoe_size");
  assert.equal(select("wish_items"), "household_id, member_id, kind, label");
});

test("the database decides which families are approved, not the page", () => {
  assert.match(printFamiliesBlock(), /found\.filter\(\(row\) => row\.status === "live"\)/);
});

test("the print path mentions no identifying field, never reads the roster's rows, and logs nothing", () => {
  const block = printFamiliesBlock();
  for (const field of [...IDENTIFYING, "contactOf", "console."]) {
    assert.ok(!block.includes(field), `printFamilies must not reference ${field}`);
  }
  assert.doesNotMatch(block, /\bemail\b|\bphone\b/, "printFamilies must not reference an email or phone");
  // `households` the roster array, as opposed to the "households" table.
  assert.doesNotMatch(block, /(?<!")\bhouseholds\b/, "printFamilies must not read the roster's rows");
});

test("the picker copies four named fields per family out of the roster, never a name", () => {
  const block = functionBlock("approvedFamilies");
  const copied = block.match(/\.map\(\(h\) => \((\{[^}]*\})\)\)/);
  assert.ok(copied, "expected approvedFamilies to copy fields with .map((h) => ({ ... }))");
  assert.equal(squash(copied[1]), "{ id: h.id, refCode: h.ref_code, summary: h.summary, status: shownStatus(h) }");
  for (const field of [...IDENTIFYING, "contactOf", "console."]) {
    assert.ok(!block.includes(field), `approvedFamilies must not reference ${field}`);
  }
});

test("the picker lists approved families only", () => {
  assert.match(functionBlock("approvedFamilies"), /\.filter\(\(h\) => PRINTABLE\.has\(shownStatus\(h\)\)\)/);
});

test("a picker row shows number, summary and status, nothing else", () => {
  const block = functionBlock("pickerRow");
  const used = new Set([...block.matchAll(/family\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), ["id", "refCode", "status", "summary"]);
});

test("the picker opens with nothing ticked", () => {
  const start = dashboardSource.indexOf("openPicker.onclick = () => {");
  assert.ok(start !== -1, "expected an openPicker.onclick handler");
  const handler = dashboardSource.slice(start, dashboardSource.indexOf("\n};", start));
  assert.match(handler, /selected = new Set\(\);/);
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
