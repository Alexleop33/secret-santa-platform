// How the dashboard wires up the roster search (Epic #17, slice 17b). What
// the coordinator types can be a family's first name, so it must stay in
// the page's memory: never in the URL, the browser history, browser
// storage or a log (CLAUDE.md: no family PII in URLs, query strings or
// logs). These read the files rather than running them, like
// dashboard-csv.test.js: dashboard.js loads Supabase from a CDN.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(import.meta.dirname, "..", "public");
const read = (file) => fs.readFileSync(path.join(PUBLIC, file), "utf8");

// Comments are allowed to talk about forms, the URL or the history; only
// the code counts. Strips <!-- ... --> from the page, and /* ... */ and
// // ... from scripts (but not the // inside "https://").
const html = read("dashboard.html").replace(/<!--[\s\S]*?-->/g, "");
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const dashboard = code(read("dashboard.js"));
const filter = code(read("roster-filter.js"));

function searchBox() {
  const match = html.match(/<input[^>]*id="roster-search"[^>]*>/);
  assert.ok(match, "dashboard.html must have the roster search box");
  return match[0];
}

test("the search box can't be submitted, so Enter can't put a name in the URL", () => {
  assert.doesNotMatch(html, /<form/, "dashboard.html must have no <form>");
  assert.doesNotMatch(searchBox(), /\sname=/, "the search box must have no name attribute");
});

test("the browser neither remembers nor spell-checks what's typed", () => {
  assert.match(searchBox(), /autocomplete="off"/);
  assert.match(searchBox(), /spellcheck="false"/);
});

test("the dashboard never touches the URL, history, browser storage, cookies or a log", () => {
  const forbidden = [/\blocation\b/, /\bhistory\b/, /localStorage/, /sessionStorage/, /document\.cookie/, /\bconsole\.(log|info|warn|error|debug|table|trace)\b/];
  for (const [file, source] of [["dashboard.js", dashboard], ["roster-filter.js", filter]]) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} matches ${pattern}`);
    }
  }
});

test("the search compares text and never builds a pattern from what's typed", () => {
  assert.doesNotMatch(filter, /RegExp|\.match\(|\.search\(|\.replace\(/);
});

test("the column filters see exactly Provider, Status, Sponsor and Updated", () => {
  const squash = (text) => text.replace(/\s+/g, " ");
  assert.ok(
    squash(dashboard).includes('return { provider: contactOf(h)?.referral_source ?? "", status: shownStatus(h), sponsor: sponsorOf(h), updated: localDay(h.updated_at), };'),
    "filterValues must hand over provider, status, sponsor and updated date, and nothing else",
  );
});

// Provider names and summaries are typed by families. They're drawn with
// textContent, which shows text as text; innerHTML would run it as markup.
test("the dashboard only ever empties innerHTML, never fills it", () => {
  assert.doesNotMatch(dashboard, /\.innerHTML\s*=(?!\s*""\s*;)/);
});

test("the search looks through exactly the five cells Story #12 names", () => {
  assert.ok(
    dashboard.includes('return [h.ref_code, contact?.household_first_name ?? "", contact?.referral_source ?? "", h.summary, shortDate(h.updated_at)];'),
    "searchCells must return ID, name, provider, household and updated date, and nothing else",
  );
});
