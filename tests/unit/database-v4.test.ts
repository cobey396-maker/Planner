import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "../db/harness";

/** Migration 4: chosen usernames at sign-up, availability check, rules. */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

const handleOf = async (id: string) =>
  (await db.query<{ handle: string }>("select handle from profiles where id = $1", [id])).rows[0].handle;
const available = async (name: string, as?: string) => {
  const run = async (q: { query: PGlite["query"] }) =>
    (await q.query<{ ok: boolean }>("select username_available($1) as ok", [name])).rows[0].ok;
  return as ? asUser(db, as, run) : run(db);
};

describe("usernames", () => {
  it("sign-up uses the chosen username (lowercased)", async () => {
    const id = await createUser(db, "a@test.dev", { display_name: "Cobey", username: "Cobey_D" });
    expect(await handleOf(id)).toBe("cobey_d");
  });

  it("availability: taken, invalid, reserved and look-alikes are not available", async () => {
    expect(await available("cobey_d")).toBe(false); // taken (case-insensitive)
    expect(await available("COBEY_D")).toBe(false);
    expect(await available("ab")).toBe(false); // too short
    expect(await available("has space")).toBe(false);
    expect(await available("admin")).toBe(false); // reserved
    expect(await available("user_123")).toBe(false); // looks generated
    expect(await available("maya_k")).toBe(true);
  });

  it("your own username counts as available (for the Settings form)", async () => {
    const id = await createUser(db, "self@test.dev", { username: "selfie" });
    expect(await available("selfie", id)).toBe(true);
    expect(await available("selfie")).toBe(false);
  });

  it("a taken or invalid username at sign-up falls back to a generated one (sign-up never fails)", async () => {
    const dupe = await createUser(db, "b@test.dev", { username: "cobey_d" });
    expect(await handleOf(dupe)).toMatch(/^user_[0-9a-f]{12}$/);
    const bad = await createUser(db, "c@test.dev", { username: "no!" });
    expect(await handleOf(bad)).toMatch(/^user_/);
  });

  it("changing your username: free names work, reserved and generated look-alikes don't", async () => {
    const id = await createUser(db, "d@test.dev", { username: "dana" });
    await asUser(db, id, (tx) => tx.query("update profiles set handle = 'dana_2' where id = $1", [id]));
    expect(await handleOf(id)).toBe("dana_2");
    await expect(asUser(db, id, (tx) => tx.query("update profiles set handle = 'support' where id = $1", [id]))).rejects.toThrow(/username_not_allowed/);
    await expect(asUser(db, id, (tx) => tx.query("update profiles set handle = 'user_abc' where id = $1", [id]))).rejects.toThrow(/username_not_allowed/);
    await expect(asUser(db, id, (tx) => tx.query("update profiles set handle = 'cobey_d' where id = $1", [id]))).rejects.toThrow(/profiles_handle_key|duplicate/);
  });

  it("only the server can turn a username into an email", async () => {
    const id = await createUser(db, "e@test.dev", { username: "eve" });
    await expect(asUser(db, id, (tx) => tx.query("select email_for_username('cobey_d')"))).rejects.toThrow(/permission denied/);
  });
});
