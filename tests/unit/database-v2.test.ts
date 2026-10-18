import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "../db/harness";

/** Migration 2: location, suggestions, friend requests by id, email claims. */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

let n = 0;
async function person(name: string, city?: string, region?: string) {
  const id = await createUser(db, `p${++n}@test.dev`, { display_name: name, time_zone: "America/Chicago" });
  if (city) await db.query("update profiles set city = $1, region = $2 where id = $3", [city, region ?? null, id]);
  return id;
}
async function friends(a: string, b: string) {
  await db.query("insert into friendships (requester_id, addressee_id, status, accepted_at) values ($1, $2, 'accepted', now())", [a, b]);
}
const suggestions = (viewer: string) =>
  asUser(db, viewer, async (tx) =>
    (await tx.query<{ display_name: string; mutual_count: number; reason: string }>("select display_name, mutual_count, reason from suggest_friends(10)")).rows,
  );

describe("new accounts", () => {
  it("plan 24/7 by default", async () => {
    const id = await person("Fresh");
    const { rows } = await db.query<{ day_start_minute: number; day_end_minute: number }>(
      "select day_start_minute, day_end_minute from user_settings where user_id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ day_start_minute: 0, day_end_minute: 1440 });
  });

  it("can set their city, region and photo, but only an https photo URL", async () => {
    const id = await person("Mia");
    await asUser(db, id, (tx) =>
      tx.query("update profiles set city = 'Austin', region = 'Texas', avatar_url = 'https://x.supabase.co/a.jpg' where id = $1", [id]),
    );
    await expect(
      asUser(db, id, (tx) => tx.query("update profiles set avatar_url = 'javascript:alert(1)' where id = $1", [id])),
    ).rejects.toThrow(/profiles_avatar_https/);
  });
});

describe("suggest_friends", () => {
  it("suggests nobody when you have no friends and no city (no filler people)", async () => {
    const loner = await person("Loner");
    await person("Someone Else", "Austin", "Texas");
    expect(await suggestions(loner)).toEqual([]);
  });

  it("suggests friends of friends first, with the mutual count", async () => {
    const me = await person("Me");
    const f1 = await person("F1");
    const f2 = await person("F2");
    const fof = await person("Zed Mutual");
    await friends(me, f1);
    await friends(me, f2);
    await friends(f1, fof);
    await friends(f2, fof);
    const rows = await suggestions(me);
    expect(rows[0]).toEqual({ display_name: "Zed Mutual", mutual_count: 2, reason: "mutual" });
    // Existing friends are never suggested.
    expect(rows.map((r) => r.display_name)).not.toContain("F1");
  });

  it("falls back to people in the same city and region (case-insensitive)", async () => {
    const me = await person("Local Me", "Springfield", "Illinois");
    await person("Same Town", " springfield ", "ILLINOIS");
    await person("Other Springfield", "Springfield", "Missouri");
    const rows = await suggestions(me);
    expect(rows.map((r) => r.display_name)).toEqual(["Same Town"]);
    expect(rows[0].reason).toBe("nearby");
  });

  it("respects people who turned discoverable off", async () => {
    const me = await person("Seeker", "Boise", "Idaho");
    const hidden = await person("Hidden", "Boise", "Idaho");
    await db.query("update user_settings set discoverable = false where user_id = $1", [hidden]);
    expect(await suggestions(me)).toEqual([]);
  });
});

describe("send_friend_request_to", () => {
  it("works for someone suggested to you", async () => {
    const me = await person("Asker", "Reno", "Nevada");
    const them = await person("Neighbor", "Reno", "Nevada");
    await asUser(db, me, (tx) => tx.query("select send_friend_request_to($1)", [them]));
    const { rows } = await db.query("select status from friendships where requester_id = $1 and addressee_id = $2", [me, them]);
    expect(rows).toEqual([{ status: "pending" }]);
  });

  it("refuses arbitrary user ids (no spam by guessing ids)", async () => {
    const me = await person("Spammer", "Tulsa", "Oklahoma");
    const stranger = await person("Stranger", "Miami", "Florida");
    await expect(asUser(db, me, (tx) => tx.query("select send_friend_request_to($1)", [stranger]))).rejects.toThrow(
      /Person not found/,
    );
  });
});

describe("claim_notifications (email jobs)", () => {
  async function blockFor(userId: string, startsInMin: number, lengthMin = 30) {
    const { rows } = await db.query<{ id: string }>(
      "insert into tasks (user_id, title, estimated_minutes) values ($1, 'Essay', 60) returning id",
      [userId],
    );
    await db.query(
      "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, now() + make_interval(mins => $3), now() + make_interval(mins => $4))",
      [userId, rows[0].id, startsInMin, startsInMin + lengthMin],
    );
  }
  const claim = async () =>
    (await db.query<{ kind: string; email: string; title: string }>("select kind, email, title from claim_notifications(now())")).rows;

  it("emails 'starting soon' and 'missed' exactly once each, honoring settings", async () => {
    const u = await person("Notified");
    await blockFor(u, 10); // starts in 10 min, lead is 15 → due
    await blockFor(u, 120); // too far away
    await blockFor(u, -60, 30); // ended 30 min ago, still planned → missed
    const first = (await claim()).filter((r) => r.email === `p${n}@test.dev`);
    expect(first.map((r) => r.kind).sort()).toEqual(["missed", "upcoming"]);
    // A second run (or an overlapping one) finds nothing new.
    expect((await claim()).filter((r) => r.email === `p${n}@test.dev`)).toEqual([]);
  });

  it("skips people who turned those emails off", async () => {
    const u = await person("Quiet");
    await db.query("update user_settings set notify_upcoming = false, notify_missed = false where user_id = $1", [u]);
    await blockFor(u, 5);
    await blockFor(u, -60, 30);
    expect((await claim()).filter((r) => r.email === `p${n}@test.dev`)).toEqual([]);
  });

  it("can't be called by signed-in users (it would reveal other people's emails)", async () => {
    const u = await person("Curious");
    await expect(asUser(db, u, (tx) => tx.query("select * from claim_notifications(now())"))).rejects.toThrow(
      /permission denied/,
    );
  });
});
