// The rules behind the coordinator's "Print wish lists" picker (Epic #30):
// number order, the search box, the four quick-select buttons, the
// wording, and batching. Nothing here touches the page or the database,
// so tests/print-picker.test.js can run every rule in Node.
//
// A family here is { id, refCode, summary, status }, where status is what
// the roster shows: "live" (Needs a sponsor), "sponsored" or "delivered".

// "#14" -> 14. Family numbers are "#" plus a counter, so sorting them as
// text would put #100 before #14 and #14 before #9.
export function familyNumber(refCode) {
  return Number(String(refCode).replace(/\D/g, ""));
}

export function byFamilyNumber(a, b) {
  return familyNumber(a.refCode) - familyNumber(b.refCode);
}

// The search box matches the start of the number, like the mockup: "1"
// finds #1, #10 to #19, #100 and so on. A "#" and spaces are ignored, and
// an empty box matches every family.
export function matchesSearch(refCode, query) {
  const typed = String(query ?? "").replace(/#/g, "").trim();
  if (!typed) return true;
  return String(familyNumber(refCode)).startsWith(typed);
}

// The quick-select buttons. Each one replaces the whole selection, and
// each looks at every approved family, including any the search box is
// hiding (the mockup's behaviour).
const QUICK_SELECT = {
  sponsored: (status) => status === "sponsored" || status === "delivered",
  live: (status) => status === "live",
  all: () => true,
  clear: () => false,
};

// Returns the new selection: a Set of family ids.
export function quickSelect(kind, families) {
  const keep = QUICK_SELECT[kind];
  if (!keep) throw new Error(`Unknown quick-select: ${kind}`);
  return new Set(families.filter((f) => keep(f.status)).map((f) => f.id));
}

export function printLabel(count) {
  return count === 1 ? "Print 1 family" : `Print ${count} families`;
}

// Counts families, not pages: a long wish list flows onto a second sheet,
// so the page count isn't known until the browser lays it out.
export function selectionText(count) {
  if (count === 0) return "No families selected";
  return count === 1 ? "1 family selected" : `${count} families selected`;
}

// Splits a list into batches of `size`, so a request for many families
// doesn't put hundreds of ids into one URL.
export function inBatches(list, size = 100) {
  const batches = [];
  for (let i = 0; i < list.length; i += size) batches.push(list.slice(i, i + size));
  return batches;
}
