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

// Set by the prod PR once the Cloudflare Pages project exists. While it's
// null, no hostname can resolve to prod.
export const PROD_HOSTNAME = null;

const TARGETS = {
  local: {
    env: "local",
    url: "http://127.0.0.1:54321",
    publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  },
  dev: {
    env: "dev",
    url: "https://gxgfzafrxulzltikdkca.supabase.co",
    publishableKey: "sb_publishable_3NOWW-FNhOxC2boZSVOVKQ_6AA3whlI",
  },
  // Filled in by the prod PR. Until then there is nowhere for prod to go.
  prod: null,
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
if (!target) {
  throw new Error(`No Supabase configuration for the "${name}" environment yet.`);
}

export const env = target.env;
export const SUPABASE_URL = target.url;
export const SUPABASE_ANON_KEY = target.publishableKey;
