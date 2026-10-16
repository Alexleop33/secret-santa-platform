// One pure function, with no imports, so the unit test can load it in Node.
//
// Cloudflare Pages serves clean URLs: a link to /queue.html lands on
// /queue. Locally, server.js serves the file by its name. Compare the two
// without the extension so "which page am I on" works in both places.
export function samePage(pathname, href) {
  const strip = (p) => p.replace(/\.html$/, "").replace(/\/index$/, "/");
  return strip(pathname) === strip(href);
}
