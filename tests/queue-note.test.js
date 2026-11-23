// The soft stop on the coordinator's note (Epic #27, slice 27a, decided
// with Alex 2026-11-22). Save note first asks the database's own
// identifying_text_problem() about the note. Only if it finds a phone
// number, an email or a street address does a confirmation box open, and
// she chooses: go back and edit, or save anyway. Otherwise the note saves
// with no box. supabase/tests/admin_note_check.sql covers the check itself.
//
// This reads the files rather than running them, like the other page tests:
// queue.js loads Supabase from a CDN.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(import.meta.dirname, "..", "public");
const read = (file) => fs.readFileSync(path.join(PUBLIC, file), "utf8");

// Only the code counts, not what the comments say about it.
const js = read("queue.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const html = read("queue.html").replace(/<!--[\s\S]*?-->/g, "");

function functionBlock(name) {
  const start = js.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `queue.js must define ${name}()`);
  return js.slice(start, js.indexOf("\n}\n", start));
}

test("Save note goes through the check, never straight to the save", () => {
  assert.match(js, /saveNote\.onclick = \(\) => checkThenSave\(household\.id, note, status\);/);
  // saveAdminNote() is defined once and called twice, both inside
  // checkThenSave(): when nothing is found, and on "Save anyway".
  assert.equal(js.match(/saveAdminNote\(/g).length, 3);
  assert.equal(functionBlock("checkThenSave").match(/saveAdminNote\(/g).length, 2);
});

test("the box opens only when the check finds something", () => {
  const block = functionBlock("checkThenSave");
  const nothingFound = block.indexOf("if (!found) {");
  assert.ok(nothingFound >= 0, "checkThenSave must save straight away when nothing is found");
  assert.ok(block.indexOf("noteCheck.showModal()") > nothingFound, "the box may only open after that");
});

test("the note goes to the check in a request body, never in the URL", () => {
  // rpc() sends a POST unless told { get: true }, which would put the note
  // into the query string.
  assert.ok(js.includes('supabase.rpc("identifying_text_problem", { p_text: text })'));
  assert.doesNotMatch(js, /get:\s*true/);
});

test("the text that's checked is the text that's saved", () => {
  const block = functionBlock("checkThenSave");
  const read = "const text = note.value;";
  const readAt = block.indexOf(read);
  assert.ok(readAt >= 0 && readAt < block.indexOf("await "), "the box is read once, before the check");
  assert.equal(block.match(/saveAdminNote\(id, text, status\)/g).length, 2, "both saves use the checked text");
  assert.doesNotMatch(block.slice(readAt + read.length), /note\.value/, "the box is never read again after the check");
});

test("the box names what kind of detail it found, never the detail itself", () => {
  assert.ok(js.includes("noteCheckFound.textContent = `This note looks like it contains ${found}.`;"));
});

// ---------- Slice 27b: the note stays open once a family is approved ----------
// supabase/tests/admin_note_after_decision.sql proves the database side.

function renderDetailBlock() {
  const start = js.indexOf("function renderDetail(");
  return js.slice(start, js.indexOf("\n}\n", start));
}

test("the note box is open for pending and approved families, locked for the rest", () => {
  const render = renderDetailBlock();
  assert.ok(render.includes('const editable = household.status === "pending_review" || household.status === "live";'));
  assert.ok(render.includes("note.disabled = !editable;"));
});

test("Save note comes with the box wherever it's open, not only on pending referrals", () => {
  const render = renderDetailBlock();
  const editableAt = render.indexOf("if (editable) {");
  const saveAt = render.indexOf('el("button", "btn btn-outline btn-sm", "Save note")');
  const pendingAt = render.indexOf("if (pending) {");
  assert.ok(editableAt >= 0, "renderDetail must build the note's controls inside if (editable)");
  assert.ok(saveAt > editableAt && saveAt < pendingAt, "Save note must be built inside if (editable), before the pending-only decisions");
});

test("Keep it live puts the buttons back without redrawing, so an unsaved note survives", () => {
  assert.doesNotMatch(renderDetailBlock(), /cancel\.onclick = \(\) => renderDetail\(/);
});

test("'Note saved.' comes from the database: the save asks for the row back", () => {
  const block = functionBlock("saveAdminNote");
  assert.ok(block.includes('.update({ admin_note: note }).eq("id", id).select("id")'));
  const emptyAt = block.indexOf("if (!data.length) {");
  assert.ok(emptyAt >= 0, "an empty answer must be handled");
  assert.ok(block.indexOf('"Note saved."') > emptyAt, "'Note saved.' only after the empty case is ruled out");
});

test("the box is a native dialog whose default is going back to edit", () => {
  const dialog = html.match(/<dialog[^>]*id="note-check"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(dialog, "queue.html must have the note-check dialog");
  // A screen reader reads the message (which kind of detail) as the box opens.
  assert.match(dialog, /<dialog[^>]*aria-describedby="note-check-found"/);
  assert.match(dialog, /<button[^>]*id="note-check-back"[^>]*autofocus/);
  assert.match(dialog, /<button[^>]*id="note-check-save"/);
});
