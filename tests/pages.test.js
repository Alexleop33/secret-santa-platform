// Every page in public/ must play by the Content-Security-Policy in
// public/_headers, and the CSP must allow what the pages actually use. A
// page that quietly loads a stylesheet or font from somewhere else would work
// locally (server.js sends no CSP) and break on the demo site. This test
// reads the files, not a browser, so it runs in `npm test` in a second.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PUBLIC = path.join(import.meta.dirname, "..", "public");
const htmlFiles = fs.readdirSync(PUBLIC).filter((f) => f.endsWith(".html"));
const jsFiles = fs.readdirSync(PUBLIC).filter((f) => f.endsWith(".js"));
const headers = fs.readFileSync(path.join(PUBLIC, "_headers"), "utf8");

// The hosts the CSP lets scripts and connections reach. Anything else in a
// page is a mistake, whichever way round it was introduced.
const ALLOWED_HOSTS = ["https://esm.sh", "https://wiobafdpmzzrzzqavjbf.supabase.co"];

function externalUrls(source) {
  return [...source.matchAll(/https?:\/\/[^\s"'`)<>]+/g)].map((m) => m[0]);
}

test("every page links the one stylesheet", () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(PUBLIC, file), "utf8");
    assert.match(html, /<link rel="stylesheet" href="\/styles\.css" \/?>/, `${file} must link /styles.css`);
  }
});

test("no page carries inline styles, which the CSP blocks on the hosted sites", () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(PUBLIC, file), "utf8");
    assert.doesNotMatch(html, /<style[\s>]/, `${file} has a <style> block`);
    assert.doesNotMatch(html, /\sstyle="/, `${file} has a style="" attribute`);
  }
});

test("pages and scripts load nothing from a host the CSP does not list", () => {
  for (const file of [...htmlFiles, ...jsFiles]) {
    const source = fs.readFileSync(path.join(PUBLIC, file), "utf8");
    for (const url of externalUrls(source)) {
      // Comments and user-facing text may mention a URL (the Mailpit hint,
      // for instance); only fetched resources matter. Those sit inside an
      // import, a src= or an href=.
      const fetched = new RegExp(`(import\\s+[^;]*from\\s+["']|src=["']|href=["'])${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      if (!fetched.test(source)) continue;
      assert.ok(
        ALLOWED_HOSTS.some((host) => url.startsWith(host)),
        `${file} loads ${url}, which the CSP in _headers does not allow`,
      );
    }
  }
});

test("the CSP allows the self-hosted fonts and every font file exists", () => {
  assert.match(headers, /font-src 'self'/, "_headers must allow fonts from this origin");
  const css = fs.readFileSync(path.join(PUBLIC, "styles.css"), "utf8");
  const fontUrls = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(fontUrls.length >= 2, "styles.css should declare the two font families");
  for (const name of fontUrls) {
    assert.ok(fs.existsSync(path.join(PUBLIC, "fonts", name)), `missing font file public/fonts/${name}`);
  }
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/, "fonts must not load from Google");
});
