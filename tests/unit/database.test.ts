import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "../db/harness";

/**
 * DATABASE SECURITY TESTS
 *
 * Each test signs in as a specific person and tries something, including
 * things a malicious user might try with the raw API. Row-level security is
 * only worth anything if it's tested like this: "can B see A's stuff?"
 * should be a failing query, not a hope.
 */

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

let n = 0;
/** A fresh user per test so tests never depend on each other. */
const newUser = (meta: Record<string, string> = {}) => createUser(db, `user${++n}@test.dev`, meta);

async function makeTask(userId: string, title = "Essay") {
  return asUser(db, userId, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      "insert into tasks (user_id, title, estimated_minutes) values ($1, $2, 120) returning id",
      [userId, title],
    );
    return rows[0].id;
  });
}

async function makeBlock(userId: string, taskId: string, start: string, end: string) {
  return asUser(db, userId, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, $3, $4) returning id",
      [userId, taskId, start, end],
    );
    return rows[0].id;
  });
}

/** Run as a user and expect Postgres to refuse; returns the error message. */
async function refused(userId: string | null, sql: string, params: unknown[] = []) {
  try {
    await asUser(db, userId, (tx) => tx.query(sql, params));
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`Expected this to be refused: ${sql}`);
}

async function befriend(a: string, b: string) {
  const code = await asUser(db, a, async (tx) => (await tx.query<{ c: string }>("select my_invite_code() c")).rows[0].c);
  const id = await asUser(db, b, async (tx) =>
    (await tx.query<{ id: string }>("select send_friend_request($1) id", [code])).rows[0].id,
  );
  await asUser(db, a, (tx) => tx.query("select respond_friend_request($1, true)", [id]));
}

describe("sign-up trigger", () => {
  it("creates a profile and private settings for every new account", async () => {
    const id = await newUser({ display_name: "Cobey", time_zone: "America/Chicago" });
    const { rows } = await asUser(db, id, (tx) =>
      tx.query<{ display_name: string; handle: string; time_zone: string }>(
        "select p.display_name, p.handle, s.time_zone from profiles p join user_settings s on s.user_id = p.id",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].display_name).toBe("Cobey");
    expect(rows[0].handle).toMatch(/^user_[a-f0-9]{12}$/);
    expect(rows[0].time_zone).toBe("America/Chicago");
  });

  it("falls back to UTC for a bogus time zone and the email name for a blank name", async () => {
    const id = await createUser(db, "maya.chen@test.dev", { display_name: "  ", time_zone: "Mars/Olympus" });
    const { rows } = await asUser(db, id, (tx) =>
      tx.query<{ display_name: string; time_zone: string }>(
        "select p.display_name, s.time_zone from profiles p join user_settings s on s.user_id = p.id",
      ),
    );
    expect(rows[0]).toEqual({ display_name: "maya.chen", time_zone: "UTC" });
  });

  it("rejects an unknown time zone on update", async () => {
    const id = await newUser();
    expect(await refused(id, "update user_settings set time_zone = 'Narnia/Cair'")).toMatch(/Unknown time zone/);
  });
});

describe("private data stays private", () => {
  it("nobody can read, change or delete another person's tasks, events or blocks", async () => {
    const a = await newUser();
    const b = await newUser();
    const taskId = await makeTask(a);
    await makeBlock(a, taskId, "2026-10-20T15:00Z", "2026-10-20T16:00Z");
    await asUser(db, a, (tx) =>
      tx.query(
        "insert into events (user_id, title, start_date, end_date, weekdays, start_minute, end_minute) values ($1, 'AP Chem', '2026-09-01', null, '{1,3,5}', 540, 615)",
        [a],
      ),
    );

    await asUser(db, b, async (tx) => {
      for (const table of ["tasks", "events", "blocks", "user_settings"]) {
        const { rows } = await tx.query<{ n: number }>(
          `select count(*)::int n from ${table} where user_id = $1`,
          [a],
        );
        expect(rows[0].n, table).toBe(0);
      }
      // Writes to rows you can't see silently affect nothing.
      expect((await tx.query("update tasks set title = 'hacked' where id = $1", [taskId])).affectedRows).toBe(0);
      expect((await tx.query("delete from tasks where id = $1", [taskId])).affectedRows).toBe(0);
    });

    // And A's task is untouched.
    const { rows } = await asUser(db, a, (tx) => tx.query<{ title: string }>("select title from tasks"));
    expect(rows).toEqual([{ title: "Essay" }]);
  });

  it("you can't create rows in someone else's name", async () => {
    const a = await newUser();
    const b = await newUser();
    expect(
      await refused(b, "insert into tasks (user_id, title, estimated_minutes) values ($1, 'x', 30)", [a]),
    ).toMatch(/row-level security/);
  });

  it("you can't attach a block to someone else's task", async () => {
    const a = await newUser();
    const b = await newUser();
    const aTask = await makeTask(a);
    expect(
      await refused(
        b,
        "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, '2026-10-20T15:00Z', '2026-10-20T16:00Z')",
        [b, aTask],
      ),
    ).toMatch(/row-level security/);
  });

  it("signed-out visitors can't read anything", async () => {
    expect(await refused(null, "select * from tasks")).toMatch(/permission denied/);
    expect(await refused(null, "select * from profiles")).toMatch(/permission denied/);
    expect(await refused(null, "select my_invite_code()")).toMatch(/permission denied/);
  });
});

describe("blocks", () => {
  it("never double-book you, but may touch end-to-start", async () => {
    const a = await newUser();
    const t = await makeTask(a);
    await makeBlock(a, t, "2026-10-20T15:00Z", "2026-10-20T16:00Z");
    await makeBlock(a, t, "2026-10-20T16:00Z", "2026-10-20T17:00Z"); // touching: fine
    expect(
      await refused(a, "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, '2026-10-20T15:30Z', '2026-10-20T16:30Z')", [a, t]),
    ).toMatch(/blocks_no_overlap/);
  });

  it("two different people CAN have blocks at the same time", async () => {
    const a = await newUser();
    const b = await newUser();
    await makeBlock(a, await makeTask(a), "2026-10-21T15:00Z", "2026-10-21T16:00Z");
    await expect(makeBlock(b, await makeTask(b), "2026-10-21T15:00Z", "2026-10-21T16:00Z")).resolves.toBeTruthy();
  });

  it("reject end-before-start", async () => {
    const a = await newUser();
    const t = await makeTask(a);
    expect(
      await refused(a, "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, '2026-10-20T16:00Z', '2026-10-20T15:00Z')", [a, t]),
    ).toMatch(/blocks_time_order/);
  });
});

describe("points can't be faked", () => {
  it("users can read their points but never insert them directly", async () => {
    const a = await newUser();
    expect(
      await refused(a, "insert into points_ledger (user_id, points, reason) values ($1, 1000, 'trust me')", [a]),
    ).toMatch(/permission denied/);
  });

  it("complete_block awards XP exactly once, and undo takes it back", async () => {
    const a = await newUser();
    const block = await makeBlock(a, await makeTask(a), "2026-10-22T15:00Z", "2026-10-22T16:00Z");
    await asUser(db, a, async (tx) => {
      const award = async () => (await tx.query<{ p: number }>("select complete_block($1) p", [block])).rows[0].p;
      const total = async () => (await tx.query<{ t: number }>("select coalesce(sum(points),0)::int t from points_ledger")).rows[0].t;
      // 100 XP, or 150 if the test happens to run before 9 AM (early bonus).
      const first = await award();
      expect([100, 150]).toContain(first);
      expect(await award()).toBe(0); // double-tap, retry, replay: still the same total
      expect(await total()).toBe(first);
      await tx.query("select uncomplete_block($1)", [block]);
      expect(await total()).toBe(0);
      expect(await award()).toBe(first);
    });
  });

  it("you can't complete someone else's block", async () => {
    const a = await newUser();
    const b = await newUser();
    const block = await makeBlock(a, await makeTask(a), "2026-10-23T15:00Z", "2026-10-23T16:00Z");
    expect(await refused(b, "select complete_block($1)", [block])).toMatch(/Block not found/);
  });
});

describe("friends", () => {
  it("invite codes are secret: not readable from the table, only via my_invite_code()", async () => {
    const a = await newUser();
    expect(await refused(a, "select invite_code from profiles")).toMatch(/permission denied/);
    const code = await asUser(db, a, async (tx) => (await tx.query<{ c: string }>("select my_invite_code() c")).rows[0].c);
    expect(code).toMatch(/^[a-f0-9]{12}$/);
  });

  it("strangers can't see your profile; friends and requesters can", async () => {
    const a = await newUser({ display_name: "Ana" });
    const b = await newUser();
    const c = await newUser();
    const visible = (viewer: string) =>
      asUser(db, viewer, async (tx) => (await tx.query("select display_name from profiles where id = $1", [a])).rows.length);
    expect(await visible(c)).toBe(0);
    await befriend(a, b);
    expect(await visible(b)).toBe(1);
    expect(await visible(c)).toBe(0);
  });

  it("requests: no self-friending, bad codes fail, crossing requests auto-accept", async () => {
    const a = await newUser();
    const b = await newUser();
    const codeOf = (u: string) =>
      asUser(db, u, async (tx) => (await tx.query<{ c: string }>("select my_invite_code() c")).rows[0].c);
    expect(await refused(a, "select send_friend_request($1)", [await codeOf(a)])).toMatch(/your own invite link/);
    expect(await refused(a, "select send_friend_request('nope')")).toMatch(/Invite link not found/);

    // A asks B; then B (not seeing it yet) asks A: that simply accepts.
    const bCode = await codeOf(b);
    const aCode = await codeOf(a);
    const id1 = await asUser(db, a, async (tx) => (await tx.query<{ id: string }>("select send_friend_request($1) id", [bCode])).rows[0].id);
    const id2 = await asUser(db, b, async (tx) => (await tx.query<{ id: string }>("select send_friend_request($1) id", [aCode])).rows[0].id);
    expect(id2).toBe(id1);
    const { rows } = await asUser(db, a, (tx) => tx.query<{ status: string }>("select status from friendships"));
    expect(rows).toEqual([{ status: "accepted" }]);
  });

  it("friends see ONLY busy times, never event or task details", async () => {
    const a = await newUser({ time_zone: "America/Chicago" });
    const b = await newUser();
    await asUser(db, a, (tx) =>
      tx.query(
        // Gym, Mondays and Wednesdays 6–7 PM Chicago time.
        "insert into events (user_id, title, start_date, weekdays, start_minute, end_minute) values ($1, 'Therapy', '2026-09-01', '{1,3}', 1080, 1140)",
        [a],
      ),
    );
    const busy = () =>
      asUser(db, b, async (tx) =>
        (
          await tx.query<Record<string, unknown>>(
            "select * from friend_busy_intervals($1, '2026-10-26T00:00Z', '2026-11-03T06:00Z')",
            [a],
          )
        ).rows,
      );

    // Not friends yet → nothing.
    expect(await busy()).toEqual([]);

    await befriend(a, b);
    const rows = await busy();
    // Only two columns ever come back: no titles, no colors.
    expect(Object.keys(rows[0]).sort()).toEqual(["ends_at", "starts_at"]);
    // And the event table itself stays invisible to the friend.
    const leaked = await asUser(db, b, async (tx) => (await tx.query("select * from events where user_id = $1", [a])).rows);
    expect(leaked).toEqual([]);

    // Daylight saving: US clocks fall back on Sun Nov 1 2026. "6 PM" stays
    // 6 PM local, so the UTC time shifts by an hour across the change.
    const starts = rows.map((r) => (r.starts_at as Date).toISOString());
    expect(starts).toEqual([
      "2026-10-26T23:00:00.000Z", // Mon Oct 26, 6 PM CDT (UTC−5)
      "2026-10-28T23:00:00.000Z", // Wed Oct 28, 6 PM CDT
      "2026-11-03T00:00:00.000Z", // Mon Nov 2, 6 PM CST (UTC−6)
    ]);
  });

  it("nobody can probe whether two OTHER people are friends", async () => {
    const a = await newUser();
    const b = await newUser();
    const c = await newUser();
    await befriend(a, b);
    const probe = (viewer: string) =>
      asUser(db, viewer, async (tx) => (await tx.query<{ f: boolean }>("select are_friends($1, $2) f", [a, b])).rows[0].f);
    expect(await probe(a)).toBe(true);
    expect(await probe(c)).toBe(false);
  });
});

describe("hangout invites", () => {
  const slot = ["2026-10-29T22:00Z", "2026-10-29T23:30Z"];

  it("can only be sent to friends", async () => {
    const a = await newUser();
    const b = await newUser();
    const c = await newUser();
    await befriend(a, b);
    await asUser(db, b, (tx) =>
      tx.query("insert into hangout_invites (from_user_id, to_user_id, starts_at, ends_at, activity) values ($1, $2, $3, $4, 'Study')", [b, a, ...slot]),
    );
    expect(
      await refused(c, "insert into hangout_invites (from_user_id, to_user_id, starts_at, ends_at, activity) values ($1, $2, $3, $4, 'Study')", [c, a, ...slot]),
    ).toMatch(/row-level security/);
  });

  it("the recipient can answer, but can't rewrite the invite; the sender can't answer it", async () => {
    const a = await newUser();
    const b = await newUser();
    await befriend(a, b);
    const id = await asUser(db, b, async (tx) =>
      (
        await tx.query<{ id: string }>(
          "insert into hangout_invites (from_user_id, to_user_id, starts_at, ends_at, activity) values ($1, $2, $3, $4, 'Gym') returning id",
          [b, a, ...slot],
        )
      ).rows[0].id,
    );
    expect(await refused(a, "update hangout_invites set starts_at = now() where id = $1", [id])).toMatch(/permission denied/);
    const senderAnswer = await asUser(db, b, (tx) => tx.query("update hangout_invites set status = 'accepted' where id = $1", [id]));
    expect(senderAnswer.affectedRows).toBe(0);
    const answer = await asUser(db, a, (tx) =>
      tx.query("update hangout_invites set status = 'accepted', responded_at = now() where id = $1", [id]),
    );
    expect(answer.affectedRows).toBe(1);
  });
});
