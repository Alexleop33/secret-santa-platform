// Which roster rows the dashboard shows (Epic #17). Pure: no page, no
// database and no imports, so node can test it (tests/roster-filter.test.js).
//
// What the coordinator types can be a family's first name. It stays in the
// page's memory: nothing here or in dashboard.js puts it anywhere else. The
// same goes for her filters.

// ---------- The search box (slice 17b) ----------

// A row matches when any of its cells contains what she typed, ignoring
// capitals and spaces at either end. An empty box matches every row. It is
// a plain text comparison with includes(), never a pattern, so "(" or "*"
// are just characters, and text a family typed is only ever compared.
export function rowMatches(cells, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return cells.some((cell) => (cell ?? "").toLowerCase().includes(needle));
}

// ---------- The column filters (slice 17c) ----------
//
// A family's filterable values look like
//   { provider: "School counselor", status: "live", sponsor: "", updated: "2026-11-21" }
// where "" means none (no provider given, no sponsor yet) and the date is
// the day it was last updated. Filters hold at most one value per column,
// e.g. { status: "approved", provider: "School counselor" }.

// "Approved" in the Status menu stands for all three approved statuses
// (decided with Alex 2026-11-21): needs a sponsor, sponsored, delivered.
export const APPROVED = new Set(["live", "sponsored", "delivered"]);

// The order the Status menu lists statuses in, after "Approved".
const STATUS_ORDER = ["pending_review", "live", "sponsored", "delivered", "rejected", "withdrawn"];

// A family stays if it passes every filter that's on: filters on different
// columns stack.
export function passesFilters(values, filters) {
  return Object.entries(filters).every(([column, wanted]) =>
    column === "status" && wanted === "approved" ? APPROVED.has(values.status) : values[column] === wanted,
  );
}

// What a column's menu offers, worked out from every family rather than
// just the ones on screen, so she can always switch to another value.
// Status: "approved", then the statuses present, in a fixed order. The
// others: each value once, none ("") first, dates oldest first.
export function menuValues(column, rows) {
  const present = new Set(rows.map((values) => values[column]));
  if (column === "status") return ["approved", ...STATUS_ORDER.filter((status) => present.has(status))];
  return [...present].sort((a, b) => a.localeCompare(b));
}

// ---------- What the roster says about it ----------

// The line beside the Roster heading: "10 families" with nothing on, "3 of
// 10 families match “test”" while she searches, "Showing 3 of 10 families"
// once any filter is on (the filter chips say which).
export function countText(shown, total, query, filterCount = 0) {
  const families = `${total} ${total === 1 ? "family" : "families"}`;
  const typed = query.trim();
  if (filterCount > 0) return `Showing ${shown} of ${families}`;
  if (!typed) return families;
  return `${shown} of ${families} ${shown === 1 ? "matches" : "match"} “${typed}”`;
}

// The message under the table's header when nothing is left to show.
export function noMatchText(query, filterCount) {
  const typed = query.trim();
  if (typed && filterCount > 0) return `No families match “${typed}” with these filters.`;
  if (typed) return `No families match “${typed}”.`;
  return "No families match these filters.";
}
