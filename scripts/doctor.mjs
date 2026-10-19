/* eslint-disable @typescript-eslint/no-unused-expressions -- "check ? ok() : bad()" reads best in a report script */
/**
 * PLANNER DOCTOR: checks your setup and prints a report you can share.
 *
 *   npm.cmd run doctor
 *
 * It reads .env.local (but never prints secrets), connects to your database,
 * and checks: settings, which database updates are applied, every account's
 * rows, and whether saving a task works for real. That last check runs
 * inside a transaction that is ROLLED BACK, so it never changes your data.
 */
import { readdirSync } from "node:fs";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log(
    "✗ No .env.local file found in this folder. Run this from the planner folder.",
  );
  process.exit(1);
}

const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => console.log(`  ✗ ${msg}`);
const info = (msg) => console.log(`    ${msg}`);
const mask = (email) =>
  email ? email.replace(/^(.).*(@.*)$/, "$1***$2") : "(no email)";

console.log("\n1. Settings (.env.local)");
const env = process.env;
for (const name of [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]) {
  env[name] ? ok(`${name} is set`) : bad(`${name} is missing`);
}
for (const name of ["SUPABASE_SECRET_KEY", "ANTHROPIC_API_KEY"]) {
  info(`${name}: ${env[name] ? "set" : "not set (optional)"}`);
}
// The app (Supabase URL) and the migrations (database URL) must be the SAME project.
const urlRef = env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];
const dbUrl = env.DIRECT_URL || env.DATABASE_URL || "";
const dbRef =
  dbUrl.match(/postgres\.([a-z0-9]+)[:@]/)?.[1] ??
  dbUrl.match(/db\.([a-z0-9]+)\.supabase\.co/)?.[1];
if (urlRef && dbRef) {
  urlRef === dbRef
    ? ok(
        `The app and the database point at the same Supabase project (${urlRef})`,
      )
    : bad(
        `MISMATCH: the app uses project "${urlRef}" but the database URL is project "${dbRef}". Updates went to a different database than the app reads!`,
      );
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
try {
  await client.connect();
  ok("Connected to the database");
} catch (e) {
  bad(`Couldn't connect to the database: ${e.message}`);
  process.exit(1);
}
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

console.log("\n2. Database updates (migrations)");
const wanted = readdirSync("prisma/migrations")
  .filter((d) => /^\d+_/.test(d))
  .sort();
let applied = [];
try {
  applied = await q(
    "select migration_name, finished_at, rolled_back_at, logs from _prisma_migrations order by started_at",
  );
} catch (e) {
  bad(`No migration history table: ${e.message}`);
}
for (const name of wanted) {
  const row = applied.find((r) => r.migration_name === name);
  if (!row) bad(`${name}: NOT applied`);
  else if (row.rolled_back_at) bad(`${name}: rolled back`);
  else if (!row.finished_at) {
    bad(`${name}: FAILED partway`);
    if (row.logs)
      info(`error: ${String(row.logs).split("\n").slice(0, 4).join(" | ")}`);
  } else ok(`${name}`);
}

console.log("\n3. Required database pieces");
try {
  const checks = [
    ["column", "user_settings", "flame_style"],
    ["column", "profiles", "avatar_url"],
    ["function", "ensure_my_account"],
    ["function", "complete_block"],
    ["function", "apply_missed_penalties"],
    ["function", "username_available"],
    ["function", "friends_leaderboard"],
  ];
  for (const [kind, a, b] of checks) {
    const found =
      kind === "column"
        ? (
            await q(
              "select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2",
              [a, b],
            )
          ).length
        : (
            await q(
              "select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1",
              [a],
            )
          ).length;
    found
      ? ok(kind === "column" ? `${a}.${b}` : `${a}()`)
      : bad(`missing ${kind === "column" ? `${a}.${b}` : `${a}()`}`);
  }
} catch (e) {
  bad(`Couldn't check: ${e.message}`);
}

console.log("\n4. Accounts");
let users = [];
try {
  users = await q(`
  select u.id, u.email, u.created_at, u.raw_user_meta_data ->> 'onboarded' as onboarded,
    p.id is not null as has_profile, p.handle, s.user_id is not null as has_settings, s.time_zone,
    (select count(*)::int from public.tasks t where t.user_id = u.id) as tasks,
    (select count(*)::int from public.blocks b where b.user_id = u.id) as blocks,
    (select max(b.created_at) from public.blocks b where b.user_id = u.id) as last_block
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_settings s on s.user_id = u.id
  order by u.created_at desc limit 10`);
} catch (e) {
  bad(`Couldn't read accounts: ${e.message}`);
}
if (users.length === 0) bad("No accounts found");
for (const u of users) {
  console.log(
    `  • ${mask(u.email)} (created ${u.created_at.toISOString().slice(0, 10)})`,
  );
  u.has_profile
    ? ok(`profile row (@${u.handle})`)
    : bad("NO profile row: tasks can't be saved for this account");
  u.has_settings
    ? ok(`settings row (time zone ${u.time_zone})`)
    : bad("NO settings row");
  info(
    `onboarded: ${u.onboarded ?? "no"} · tasks: ${u.tasks} · blocks: ${u.blocks} · last block saved: ${u.last_block ? u.last_block.toISOString() : "never"}`,
  );
}

console.log("\n5. Test: save a task exactly like the app does (then undo it)");
const target = users.find((u) => u.has_profile) ?? users[0];
if (target) {
  try {
    await client.query("begin");
    // Act as that user, with the same permissions the app has.
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: target.id, role: "authenticated" }),
    ]);
    await client.query("set local role authenticated");
    const task = await q(
      "insert into public.tasks (user_id, title, color, estimated_minutes, min_session_minutes) values ($1, 'Doctor test', 'orange', 30, 30) returning id",
      [target.id],
    );
    const start = new Date(Date.now() + 400 * 86_400_000); // far in the future, to avoid real blocks
    await q(
      "insert into public.blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, $3, $4)",
      [
        target.id,
        task[0].id,
        start.toISOString(),
        new Date(start.getTime() + 30 * 60_000).toISOString(),
      ],
    );
    const back = await q(
      "select count(*)::int as n from public.blocks b join public.tasks t on t.id = b.task_id where t.title = 'Doctor test'",
    );
    back[0].n === 1
      ? ok(`Saving and reading back a task works for ${mask(target.email)}`)
      : bad("Saved, but couldn't read it back (permissions)");
  } catch (e) {
    bad(
      `Saving a task FAILED for ${mask(target.email)}: ${e.message} (code ${e.code})`,
    );
  } finally {
    await client.query("rollback");
  }
}

await client.end();
console.log(
  "\nDone. Copy everything above and send it over (it contains no passwords or keys).\n",
);
