// Story #12, criterion 5: the Browse page loses the line under the list,
// "4 families have already been sponsored this season. Once a household is
// claimed it comes straight off this list...". The whole line goes, both
// sentences, as the client's mockup shows (decided with Alex 2026-11-21).
// The count at the top of the page stays.
//
// This reads the files rather than running them, like dashboard-csv.test.js:
// browse.js loads the Supabase client from a CDN, which node can't import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(import.meta.dirname, "..", "public");
const js = fs.readFileSync(path.join(PUBLIC, "browse.js"), "utf8");
const html = fs.readFileSync(path.join(PUBLIC, "browse.html"), "utf8");

test("the line under the list is gone, both sentences and its element", () => {
  for (const [file, source] of [["browse.js", js], ["browse.html", html]]) {
    assert.ok(!source.includes("already been sponsored this season"), `${file} still has the sponsored sentence`);
    assert.ok(!source.includes("comes straight off this list"), `${file} still has the claimed sentence`);
    assert.ok(!source.includes("browse-foot"), `${file} still has the line's element`);
  }
});

test("the count at the top of the page stays", () => {
  assert.ok(js.includes("`${need} need a sponsor · ${count.sponsored} already sponsored`"), "the count with sponsors is missing");
  assert.ok(js.includes("`${need} need a sponsor`"), "the count without sponsors is missing");
});
