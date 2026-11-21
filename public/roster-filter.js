// Which roster rows the dashboard shows (Epic #17). Pure: no page, no
// database and no imports, so node can test it (tests/roster-filter.test.js).
//
// What the coordinator types can be a family's first name. It stays in the
// page's memory: nothing here or in dashboard.js puts it anywhere else.

// A row matches when any of its cells contains what she typed, ignoring
// capitals and spaces at either end. An empty box matches every row. It is
// a plain text comparison with includes(), never a pattern, so "(" or "*"
// are just characters, and text a family typed is only ever compared.
export function rowMatches(cells, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return cells.some((cell) => (cell ?? "").toLowerCase().includes(needle));
}

// The line beside the Roster heading: "10 families" when the box is empty,
// "3 of 10 families match “test”" while she searches.
export function countText(shown, total, query) {
  const families = `${total} ${total === 1 ? "family" : "families"}`;
  const typed = query.trim();
  if (!typed) return families;
  return `${shown} of ${families} ${shown === 1 ? "matches" : "match"} “${typed}”`;
}
