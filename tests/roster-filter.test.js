// The rules for which roster rows the dashboard shows (Epic #17). Slice 17b:
// the search box. roster-filter.js imports nothing, so node runs it
// directly, the same way print-picker.test.js tests the picker's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowMatches, countText } from "../public/roster-filter.js";

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
