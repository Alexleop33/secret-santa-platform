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

test("a value that would be a formula in a spreadsheet is neutralised", () => {
  for (const payload of ['=IMPORTXML("https://x.test","//a")', "+1+1", "-2", "@SUM(A1)", "\tcmd"]) {
    const csv = toCsv([{ id: "#1", household: payload, status: "live" }], COLUMNS);
    const cell = csv.split("\r\n")[1].split(",").slice(1, -1).join(",");
    assert.ok(cell.startsWith("\"'"), `${JSON.stringify(payload)} must be prefixed with an apostrophe and quoted, got ${cell}`);
  }
});

test("ordinary text is not touched by the formula guard", () => {
  const csv = toCsv([{ id: "#1", household: "A family of four", status: "live" }], COLUMNS);
  assert.equal(csv.split("\r\n")[1], "#1,A family of four,live");
});
