// `npm run make-admin -- you@example.test` — makes a LOCAL account the admin.
//
// There is no sign-up flow for admins: one `profiles` row with role 'admin'
// is what makes an account the admin. On the hosted projects that row is
// inserted by hand in the Supabase dashboard (see supabase/README.md). On
// your own machine, this script does it for you.
//
// It can only ever touch the local database. It runs psql inside the Docker
// container that `supabase start` created, by that container's fixed name.
// There is no URL, key or environment variable that could point it at a
// hosted project — if the container isn't there, the script fails.
//
// The account has to exist first: sign in once via the emailed link, then
// run this.
import { spawnSync } from "node:child_process";

// `supabase_db_<project_id>`, where project_id comes from supabase/config.toml.
const LOCAL_DB_CONTAINER = "supabase_db_platform";

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: npm run make-admin -- you@example.test");
  process.exit(1);
}

// `:'email'` is psql's way of pasting a variable in as a properly quoted
// string literal, so an odd character in the address can't change the SQL.
// `on conflict` means running it twice is harmless. The SQL goes in on
// stdin rather than `-c`, because psql only substitutes variables when it
// reads commands from input.
const sql = `
  insert into profiles (id, role)
  select id, 'admin' from auth.users where email = :'email'
  on conflict (id) do update set role = 'admin';
`;

const result = spawnSync(
  "docker",
  [
    "exec", "-i", LOCAL_DB_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1",
    "-v", `email=${email}`,
  ],
  { encoding: "utf8", input: sql },
);

if (result.status !== 0) {
  console.error((result.stderr || result.stdout || "").trim());
  console.error("Couldn't run that against the local database. Is `npm run dev` running?");
  process.exit(1);
}

// psql reports what the statement did as a tag like "INSERT 0 1". A trailing
// 0 means no auth.users row matched — that address hasn't signed in yet.
if (result.stdout.trim().endsWith(" 0")) {
  console.error(`No local account for ${email} yet. Sign in once at http://localhost:3000, then run this again.`);
  process.exit(1);
}

console.log(`${email} is now the admin on the local database.`);
