// The "Print wish lists" picker's rules, run for real: print-picker.js has
// no page or database code, so Node can import it directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  familyNumber,
  byFamilyNumber,
  matchesSearch,
  quickSelect,
  printLabel,
  selectionText,
  inBatches,
} from "../public/print-picker.js";

// Synthetic families, obviously fake.
const FAMILIES = [
  { id: "a", refCode: "#14", status: "sponsored" },
  { id: "b", refCode: "#9", status: "delivered" },
  { id: "c", refCode: "#100", status: "live" },
  { id: "d", refCode: "#22", status: "live" },
  { id: "e", refCode: "#1", status: "sponsored" },
];

test("family numbers sort as numbers, not as text", () => {
  assert.equal(familyNumber("#14"), 14);
  const order = [...FAMILIES].sort(byFamilyNumber).map((f) => f.refCode);
  assert.deepEqual(order, ["#1", "#9", "#14", "#22", "#100"]);
});

test("the search box matches the start of the family number", () => {
  const found = (q) => FAMILIES.filter((f) => matchesSearch(f.refCode, q)).map((f) => f.refCode);
  assert.deepEqual(found("1"), ["#14", "#100", "#1"]);
  assert.deepEqual(found("14"), ["#14"]);
  assert.deepEqual(found("#14"), ["#14"], "a typed # is ignored");
  assert.deepEqual(found(" 22 "), ["#22"], "spaces are ignored");
  assert.deepEqual(found("4"), [], "4 does not match #14: it matches from the start");
  assert.deepEqual(found("abc"), []);
  assert.equal(found("").length, FAMILIES.length, "an empty box shows every family");
});

test("All sponsored picks sponsored and delivered families", () => {
  assert.deepEqual(quickSelect("sponsored", FAMILIES), new Set(["a", "b", "e"]));
});

test("Needs a sponsor picks only families without one", () => {
  assert.deepEqual(quickSelect("live", FAMILIES), new Set(["c", "d"]));
});

test("All picks every family and Clear picks none", () => {
  assert.equal(quickSelect("all", FAMILIES).size, FAMILIES.length);
  assert.equal(quickSelect("clear", FAMILIES).size, 0);
});

test("an unknown quick-select is an error, not an empty selection", () => {
  assert.throws(() => quickSelect("everyone", FAMILIES), /Unknown quick-select/);
});

test("the wording counts families", () => {
  assert.equal(printLabel(1), "Print 1 family");
  assert.equal(printLabel(3), "Print 3 families");
  assert.equal(selectionText(0), "No families selected");
  assert.equal(selectionText(1), "1 family selected");
  assert.equal(selectionText(3), "3 families selected");
});

test("long id lists are split into batches, short ones are not", () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  const batches = inBatches(ids, 100);
  assert.deepEqual(batches.map((b) => b.length), [100, 100, 50]);
  assert.deepEqual(batches.flat(), ids, "nothing is lost or reordered");
  assert.deepEqual(inBatches(["x"], 100), [["x"]]);
  assert.deepEqual(inBatches([], 100), []);
});
