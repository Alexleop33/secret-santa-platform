// Tiny static file server for Sub for Santa.
//
// Serves whatever file is requested out of public/, nothing more. Anything
// outside public/ — CLAUDE.md, decisions.md, package.json, a future .env —
// is unreachable over HTTP, not just unlinked.
// No framework, no build step, no dependencies (see package.json) — this
// is the entire HTTP layer for now.
//
// Port 3000 is not a default to tweak later. It's already registered as
// an authorized JavaScript origin in Google Cloud, as the Site URL in the
// hosted Supabase project, and as site_url in supabase/config.toml.
// Changing it means going back into all three.
//
// One dynamic route: /env.js. It tells the browser which Supabase project
// to talk to. By default that's the local Docker stack. Start the server
// with SUPABASE_TARGET=dev to point your local pages at the hosted dev
// project instead — the exception, not the default (see README "Run it").
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 3000;
const ROOT = path.join(import.meta.dirname, "public");

const SUPABASE_TARGET = process.env.SUPABASE_TARGET || "local";
if (SUPABASE_TARGET !== "local" && SUPABASE_TARGET !== "dev") {
  // "prod" is deliberately not an option. Nothing on a laptop talks to prod.
  console.error(`SUPABASE_TARGET must be "local" or "dev", not "${SUPABASE_TARGET}".`);
  process.exit(1);
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  // new URL(...) strips off any ?query string and gives us a clean path,
  // e.g. "/index.html?foo=bar" -> "/index.html".
  const url = new URL(req.url, "http://localhost");
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(ROOT, requestPath);

  console.log(`${req.method} ${url.pathname}`);

  // Generated, not read from disk: public/env.js is only a placeholder for
  // the hosted sites, where there is no server.js to answer this.
  if (url.pathname === "/env.js") {
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[".js"] });
    res.end(`globalThis.SUPABASE_TARGET = ${JSON.stringify(SUPABASE_TARGET)};\n`);
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const contentType = CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use — stop whatever's using it and try again.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT} (Supabase: ${SUPABASE_TARGET})`);
});
