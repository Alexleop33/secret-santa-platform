// Which Supabase project the browser talks to, decided from the page's
// hostname. One rule to remember: anything we don't recognise goes to dev.
//
//   localhost / 127.0.0.1  → local   (the Docker stack from `npm run dev`)
//                             …or dev, if server.js was started with
//                             SUPABASE_TARGET=dev (see /env.js)
//   the exact prod hostname → prod
//   everything else         → dev    (the demo site, PR previews, typos)
//
// Failing toward dev is the point. A misconfigured or unknown host must
// never end up reading or writing real households.
//
// Every key in this file is a *publishable* key — safe in a public repo by
// design. The local ones are the Supabase CLI's fixed demo values, identical
// on every machine. RLS, not the key, is what protects the data.

// The one hostname that is the live site. Exact match only — "www." in
// front or anything after it is a different host, and goes to dev. If the
// Cloudflare Pages project ends up with a different name, this is the one
// line to change (docs/environments.md).
export const PROD_HOSTNAME = "sub-for-santa.pages.dev";

const TARGETS = {
  local: {
    env: "local",
    url: "http://127.0.0.1:54321",
    publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  },
  dev: {
    env: "dev",
    url: "https://wiobafdpmzzrzzqavjbf.supabase.co",
    publishableKey: "sb_publishable_vOsuTZRKh3_3pTpoXYm2Jw_4SzWW_31",
  },
  // The live project (docs/environments.md, prod step 6). The URL and the
  // *publishable* key are public by design; RLS on that project is what
  // protects the data. Filled in 2026-10-16.
  prod: {
    env: "prod",
    url: "https://drmbknjbaigfvhxobpav.supabase.co",
    publishableKey: "sb_publishable_HaETiLCEGJVYXi5RtPN41g_uxANrVCv",
  },
};

// Pure function: hostname in, environment name out. Exported so the unit
// test (tests/config.test.js) can exercise every branch without a browser.
export function pickTarget(hostname, override, prodHostname = PROD_HOSTNAME) {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return override === "dev" ? "dev" : "local";
  }
  if (prodHostname !== null && hostname === prodHostname) {
    return "prod";
  }
  return "dev";
}

// `globalThis.SUPABASE_TARGET` is set by /env.js, which server.js generates
// locally. On the hosted sites /env.js is the static placeholder in public/,
// which sets nothing, so the hostname rule alone decides.
const name = pickTarget(globalThis.location?.hostname, globalThis.SUPABASE_TARGET);
const target = TARGETS[name];
if (!target || !target.url || !target.publishableKey) {
  throw new Error(`The "${name}" environment has no Supabase project configured yet (public/config.js).`);
}

export const env = target.env;
export const SUPABASE_URL = target.url;
export const SUPABASE_ANON_KEY = target.publishableKey;
