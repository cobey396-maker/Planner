import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "../db/harness";

/** Migration 3: accounts missing their profile/settings rows get repaired. */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

/** Simulate an account created before the sign-up trigger existed. */
async function brokenAccount(email: string) {
  const id = await createUser(db, email, { display_name: "Broken Bo" });
  await db.query("delete from user_settings where user_id = $1", [id]);
  await db.query("delete from profiles where id = $1", [id]);
  return id;
}
const rowCounts = async (id: string) => {
  const { rows } = await db.query<{ p: number; s: number }>(
    "select (select count(*)::int from profiles where id = $1) as p, (select count(*)::int from user_settings where user_id = $1) as s",
    [id],
  );
  return rows[0];
};

describe("ensure_my_account", () => {
  it("without a profile row, a task can't be saved (the bug)", async () => {
    const id = await brokenAccount("bug@test.dev");
    await expect(
      asUser(db, id, (tx) => tx.query("insert into tasks (user_id, title, estimated_minutes) values ($1, 'Essay', 60)", [id])),
    ).rejects.toThrow(/tasks_user_id_fkey/);
  });

  it("recreates the missing rows for the signed-in user, after which tasks save", async () => {
    const id = await brokenAccount("fix@test.dev");
    await asUser(db, id, (tx) => tx.query("select ensure_my_account()"));
    expect(await rowCounts(id)).toEqual({ p: 1, s: 1 });
    const { rows } = await db.query<{ display_name: string }>("select display_name from profiles where id = $1", [id]);
    expect(rows[0].display_name).toBe("Broken Bo");
    await asUser(db, id, (tx) => tx.query("insert into tasks (user_id, title, estimated_minutes) values ($1, 'Essay', 60)", [id]));
  });

  it("is harmless for a healthy account and only ever touches your own", async () => {
    const healthy = await createUser(db, "ok@test.dev", { display_name: "Okay" });
    const other = await brokenAccount("other@test.dev");
    await asUser(db, healthy, (tx) => tx.query("select ensure_my_account()"));
    expect(await rowCounts(healthy)).toEqual({ p: 1, s: 1 });
    expect(await rowCounts(other)).toEqual({ p: 0, s: 0 });
  });

  it("the internal helper can't be called directly by users", async () => {
    const id = await createUser(db, "sneaky@test.dev", {});
    const victim = await brokenAccount("victim@test.dev");
    await expect(asUser(db, id, (tx) => tx.query("select ensure_account_rows($1)", [victim]))).rejects.toThrow(/permission denied/);
  });
});
