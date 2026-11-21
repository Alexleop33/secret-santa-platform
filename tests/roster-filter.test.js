// The rules for which roster rows the dashboard shows (Epic #17). Slice 17b
// is the search box, slice 17c the column filters. roster-filter.js imports
// nothing, so node runs it directly, the same way print-picker.test.js
// tests the picker's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowMatches, countText, passesFilters, menuValues, noMatchText } from "../public/roster-filter.js";

// One synthetic row's five searched cells, in the table's order: ID, name,
// provider, household, updated. Obviously fake, as the public repo requires.
const row = ["#14", "Firstname", "Example School", "Mom & boy, 7", "Nov 19"];

test("an empty or blank box matches every row", () => {
  assert.equal(rowMatches(row, ""), true);
  assert.equal(rowMatches(row, "   "), true);
});

test("a match in any of the five cells counts, ignoring capitals", () => {
  for (const query of ["#14", "firstn", "SCHOOL", "boy, 7", "nov 19"]) {
    assert.equal(rowMatches(row, query), true, query);
  }
});

test("spaces typed at either end are ignored", () => {
  assert.equal(rowMatches(row, "  example "), true);
});

test("text that's in none of the cells doesn't match", () => {
  assert.equal(rowMatches(row, "#15"), false);
  assert.equal(rowMatches(row, "pending"), false);
});

test("it's 'contains', so a number also finds longer numbers and dates", () => {
  assert.equal(rowMatches(["#114", "", "", "Mom & girl, 9", "Nov 3"], "14"), true);
  assert.equal(rowMatches(["#20", "", "", "Dad & boy, 6", "Nov 14"], "14"), true);
});

test("what she types is plain text, never a pattern", () => {
  // As a regex, ".*" would match every row and "(" or "[" would crash.
  for (const query of ["(", "[", "*", ".*", "\\"]) {
    assert.equal(rowMatches(row, query), false, query);
  }
  assert.equal(rowMatches(["#3", "", "", "Mom (and grandma) & boy, 4", "Nov 2"], "(and"), true);
});

test("a missing cell never matches and never crashes", () => {
  assert.equal(rowMatches(["#14", undefined, null, "Mom & boy, 7", "Nov 19"], "firstname"), false);
});

test("the count beside the Roster heading", () => {
  assert.equal(countText(10, 10, ""), "10 families");
  assert.equal(countText(1, 1, ""), "1 family");
  assert.equal(countText(3, 10, "test"), "3 of 10 families match “test”");
  assert.equal(countText(1, 10, "test"), "1 of 10 families matches “test”");
  assert.equal(countText(0, 10, "  zz "), "0 of 10 families match “zz”");
});

// ---------- Slice 17c: the column filters ----------

// Each family's four filterable values, as dashboard.js hands them over.
// "" means none: no provider given, or no sponsor yet. Obviously fake.
const families = [
  { provider: "School counselor", status: "pending_review", sponsor: "", updated: "2026-11-21" },
  { provider: "", status: "live", sponsor: "", updated: "2026-11-02" },
  { provider: "Family services", status: "sponsored", sponsor: "donor@example.test", updated: "2026-11-10" },
  { provider: "School counselor", status: "delivered", sponsor: "offline: Example Club", updated: "2026-11-10" },
  { provider: "Family services", status: "withdrawn", sponsor: "", updated: "2026-10-30" },
];
const kept = (filters) => families.filter((row) => passesFilters(row, filters)).map((row) => families.indexOf(row));

test("with no filters every family stays", () => {
  assert.deepEqual(kept({}), [0, 1, 2, 3, 4]);
});

test("a filter keeps only families with exactly that value", () => {
  assert.deepEqual(kept({ provider: "School counselor" }), [0, 3]);
  assert.deepEqual(kept({ status: "withdrawn" }), [4]);
  assert.deepEqual(kept({ updated: "2026-11-10" }), [2, 3]);
});

test("'Approved' keeps needs a sponsor, sponsored and delivered, nothing else", () => {
  assert.deepEqual(kept({ status: "approved" }), [1, 2, 3]);
});

test("filters on different columns stack: a family must pass every one", () => {
  assert.deepEqual(kept({ status: "approved", provider: "School counselor" }), [3]);
  assert.deepEqual(kept({ status: "pending_review", provider: "Family services" }), []);
});

test("none is a value too: no provider given, no sponsor yet", () => {
  assert.deepEqual(kept({ provider: "" }), [1]);
  assert.deepEqual(kept({ sponsor: "" }), [0, 1, 4]);
});

test("the Status menu: Approved first, then only the statuses present, in a fixed order", () => {
  assert.deepEqual(menuValues("status", families), ["approved", "pending_review", "live", "sponsored", "delivered", "withdrawn"]);
  assert.deepEqual(menuValues("status", []), ["approved"]);
});

test("the other menus list each value once, none first, dates oldest first", () => {
  assert.deepEqual(menuValues("provider", families), ["", "Family services", "School counselor"]);
  assert.deepEqual(menuValues("sponsor", families), ["", "donor@example.test", "offline: Example Club"]);
  assert.deepEqual(menuValues("updated", families), ["2026-10-30", "2026-11-02", "2026-11-10", "2026-11-21"]);
});

test("the count while any filter is on", () => {
  assert.equal(countText(2, 5, "", 1), "Showing 2 of 5 families");
  assert.equal(countText(1, 5, "test", 2), "Showing 1 of 5 families");
});

test("the message when nothing is left", () => {
  assert.equal(noMatchText("test", 0), "No families match “test”.");
  assert.equal(noMatchText("", 1), "No families match these filters.");
  assert.equal(noMatchText(" test ", 2), "No families match “test” with these filters.");
});
