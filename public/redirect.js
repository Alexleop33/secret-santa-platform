// Sends the old address to the real one, before anything else loads.
//
// The site moved from sub-for-santa.pages.dev to projectconnectionsanta.org
// (2026-11-19). Links to the old address are already out in the world —
// referral links especially — so instead of letting the old host break, or
// quietly serve demo data (config.js sends every hostname it doesn't know
// to the dev database), this file swaps the host and keeps everything else:
// the page, the query string and, most importantly, the #fragment where a
// referral token travels. The browser never sends the fragment to any
// server, so only a script in the page can carry it across.
//
// "www." goes to the bare domain the same way. Locally (localhost) and on
// the dev site nothing happens.
//
// A plain script, not a module, loaded first in <head>: it has to run
// before the page draws or any other script asks the database anything.
// The function is on globalThis so tests/redirect.test.js can call it.
(function () {
  var CANONICAL_HOST = "projectconnectionsanta.org";
  var OLD_HOSTS = ["sub-for-santa.pages.dev", "www.projectconnectionsanta.org"];

  // Given where the browser is, where should it be? null means "stay".
  globalThis.canonicalSiteUrl = function (hostname, pathname, search, hash) {
    if (OLD_HOSTS.indexOf(hostname) === -1) return null;
    return "https://" + CANONICAL_HOST + pathname + search + hash;
  };

  if (typeof window !== "undefined" && window.location) {
    var target = globalThis.canonicalSiteUrl(
      window.location.hostname, window.location.pathname, window.location.search, window.location.hash
    );
    // replace(), not assign(): the old address shouldn't sit in history
    // where the Back button would bounce people into the redirect again.
    if (target) window.location.replace(target);
  }
})();
