// The roster export may carry exactly two fields out of the admin-only
// household_contacts table — the household's own first name and the
// referring provider's name (CLAUDE.md, 2026-11-03 exception) — and nothing
// else from it: no email, no phone, no contact_is, no coordinator note. This
// reads the export handler's source rather than running it, the same way
// pages.test.js checks the CSP without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "dashboard.js"), "utf8");

function exportBlock() {
  const start = source.indexOf('document.getElementById("export").onclick');
  const end = source.indexOf("\n};", start);
  return source.slice(start, end);
}

test("the CSV export carries the household's first name and provider", () => {
  const block = exportBlock();
  assert.ok(block.includes("household_first_name"), "export handler must select household_first_name");
  assert.ok(block.includes("referral_source"), "export handler must select referral_source");
});

test("the CSV export references none of the still-excluded contact fields", () => {
  const block = exportBlock();
  for (const forbidden of ["email", "phone", "contact_is", "submitter_first_name", "primary_channel", "family_note"]) {
    assert.ok(!block.includes(forbidden), `export handler must not reference ${forbidden}`);
  }
});

test("the CSV export's column list is exactly these seven columns, in order", () => {
  const block = exportBlock();
  const columnsLine = block.match(/const columns = (\[.*\]);/)[1];
  assert.equal(
    columnsLine,
    '[["id", "id"], ["name", "name"], ["provider", "provider"], ["household", "household"], ["status", "status"], ["sponsor", "sponsor"], ["updated", "updated"]]',
  );
});

test("the households query embeds household_contacts by named field, never a wildcard", () => {
  const match = source.match(/\.select\("id, ref_code,.*household_contacts \(([^)]*)\)"\)/);
  assert.ok(match, "expected the households query's .select(...) to still embed household_contacts");
  assert.equal(match[1].trim(), "household_first_name, referral_source");
});
