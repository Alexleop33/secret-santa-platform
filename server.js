// Tiny static file server for Sub for Santa.
//
// Serves whatever file is requested out of public/, nothing more. Anything
// outside public/ — CLAUDE.md, decisions.md, package.json, a future .env —
// is unreachable over HTTP, not just unlinked.
// No framework, no build step, no dependencies (see package.json) — this
// is the entire HTTP layer for now.
//
// Port 3000 is not a default to tweak later. It's already registered as
// an authorized JavaScript origin in Google Cloud and as the Site URL in
// Supabase. Changing it means going back into both consoles.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 3000;
const ROOT = path.join(import.meta.dirname, "public");

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
  console.log(`listening on http://localhost:${PORT}`);
});
