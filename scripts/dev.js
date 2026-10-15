// `npm run dev` — the one command that brings the whole app up on your own
// machine. Nothing here needs a Supabase, Google or Cloudflare account.
//
// It does four things, in order, and stops at the first one that fails:
//   1. Checks Docker is running (the local database lives in Docker).
//   2. `supabase start` — Postgres, Auth, the REST API and Mailpit, as
//      containers. Skips the pieces this app doesn't use (see package.json).
//   3. `supabase db reset` — wipes the local database, re-applies every
//      migration, then loads seed.sql. Local data never survives a restart,
//      on purpose: what you see is always what the migrations say.
//   4. Starts server.js pointed at the local database.
//
// Ctrl-C stops the web server only. The containers keep running so the next
// `npm run dev` is fast. `npm run db:stop` shuts them down.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

// On Windows, npm is `npm.cmd`, and Node will only run a .cmd through a shell.
const onWindows = process.platform === "win32";
const npm = onWindows ? "npm.cmd" : "npm";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: onWindows,
  });
  return result.status === 0;
}

// `docker info` talks to the Docker daemon. If that fails, Docker Desktop
// isn't running (or isn't installed), and nothing below can work.
const dockerIsUp = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
if (!dockerIsUp) {
  console.error("Docker isn't running. Start Docker Desktop, then run `npm run dev` again.");
  process.exit(1);
}

if (!run(npm, ["run", "db:start"])) process.exit(1);
if (!run(npm, ["run", "db:reset"])) process.exit(1);

console.log("");
console.log("  App:      http://localhost:3000");
console.log("  Mailpit:  http://127.0.0.1:54324   (sign-in links land here)");
console.log("  Admin:    npm run make-admin -- you@example.test");
console.log("");

// `inherit` so the server's own log lines show up here, and so Ctrl-C
// reaches it directly.
const server = spawn(process.execPath, [path.join(ROOT, "server.js")], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, SUPABASE_TARGET: "local" },
});
server.on("exit", (code) => process.exit(code ?? 0));
