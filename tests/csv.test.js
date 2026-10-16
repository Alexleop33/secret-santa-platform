// The roster export must open cleanly in a spreadsheet. These prove the
// escaping rules on the values a household row can actually contain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../public/csv.js";

const COLUMNS = [["id", "id"], ["household", "household"], ["status", "status"]];

test("a header row, then one line per row, CRLF terminated", () => {
  const csv = toCsv([{ id: "#14", household: "A family of four", status: "live" }], COLUMNS);
  assert.equal(csv, "id,household,status\r\n#14,A family of four,live\r\n");
});

test("a comma in a value gets the value quoted", () => {
  const csv = toCsv([{ id: "#7", household: "Mom, dad & twin boys, age 4", status: "live" }], COLUMNS);
  assert.equal(csv.split("\r\n")[1], '#7,"Mom, dad & twin boys, age 4",live');
});

test("a quote in a value is doubled and the value quoted", () => {
  const csv = toCsv([{ id: "#9", household: 'Grandmother raising a "grandson"', status: "live" }], COLUMNS);
  assert.equal(csv.split("\r\n")[1], '#9,"Grandmother raising a ""grandson""",live');
});

test("a line break in a value stays inside the quotes", () => {
  const csv = toCsv([{ id: "#2", household: "line one\nline two", status: "live" }], COLUMNS);
  assert.equal(csv, 'id,household,status\r\n#2,"line one\nline two",live\r\n');
});

test("missing values become empty cells", () => {
  const csv = toCsv([{ id: "#1" }], COLUMNS);
  assert.equal(csv.split("\r\n")[1], "#1,,");
});

test("no rows gives just the header", () => {
  assert.equal(toCsv([], COLUMNS), "id,household,status\r\n");
});
