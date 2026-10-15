import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Test database harness.
 *
 * PGlite is real Postgres compiled to WebAssembly, running inside the test
 * process: no server to install (works the same on Windows, Mac, Linux, CI).
 * We load a small Supabase stand-in, then apply our REAL migration files in
 * order, exactly as `prisma migrate deploy` would on Supabase.
 */
const root = join(import.meta.dirname, "..", "..");

export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(root, "tests/db/supabase-shim.sql"), "utf8"));
  const migrationsDir = join(root, "prisma/migrations");
  for (const dir of readdirSync(migrationsDir).filter((d) => /^\d+_/.test(d)).sort()) {
    await db.exec(readFileSync(join(migrationsDir, dir, "migration.sql"), "utf8"));
  }
  return db;
}

/** Sign someone up the way Supabase Auth does: a row in auth.users. */
export async function createUser(
  db: PGlite,
  email: string,
  meta: Record<string, string> = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}

/**
 * Run queries AS a signed-in user, the same way Supabase's API does: inside
 * a transaction, switch to the low-privilege `authenticated` role and set the
 * JWT claims that auth.uid() reads. RLS then applies to everything inside.
 * Pass null for an anonymous (signed-out) visitor.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.exec("set local role anon");
    }
    return fn(tx);
  });
}
