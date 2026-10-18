import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { levelOf, levelStart, REWARDS, streakBonus } from "@/lib/planner/levels";
import { zonedTimeToUtc } from "@/lib/tz";
import { asUser, createTestDb, createUser } from "../db/harness";

/** Migration 5: XP, levels, rewards, missed penalties and the leaderboard. */
let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

const TZ = "America/Chicago";
const at = (day: string, h: number, m = 0) => new Date(zonedTimeToUtc(day, h * 60 + m, TZ)).toISOString();

async function person(name: string) {
  return createUser(db, `${name}@test.dev`, { display_name: name, time_zone: TZ });
}
/** A block for `uid` from `start` lasting `minutes`. Returns its id. */
async function block(uid: string, start: string, minutes = 30) {
  const task = await db.query<{ id: string }>("insert into tasks (user_id, title, estimated_minutes) values ($1, 'T', 30) returning id", [uid]);
  const end = new Date(Date.parse(start) + minutes * 60_000).toISOString();
  const { rows } = await db.query<{ id: string }>(
    "insert into blocks (user_id, task_id, starts_at, ends_at) values ($1, $2, $3, $4) returning id",
    [uid, task.rows[0].id, start, end],
  );
  return rows[0].id;
}
/** Finish a block at a given moment (as the server would at that time). */
async function finish(uid: string, blockId: string, when: string) {
  await db.query("update blocks set status = 'done', completed_at = $2 where id = $1", [blockId, when]);
  const { rows } = await db.query<{ xp: number }>("select award_completion($1, $2, $3) as xp", [uid, blockId, when]);
  return rows[0].xp;
}
const total = async (uid: string) => (await db.query<{ xp: number }>("select xp_total($1) as xp", [uid])).rows[0].xp;
const sweep = async (uid: string, when: string) =>
  (await db.query<{ missed: number; xp_lost: number }>("select * from apply_missed_penalties_for($1, $2)", [uid, when])).rows[0];

describe("levels: the database and the app agree", () => {
  it("level_start and level_of match lib/planner/levels.ts", async () => {
    const { rows } = await db.query<{ n: number; start: number }>("select n, level_start(n) as start from generate_series(1, 200) n");
    for (const r of rows) expect(r.start).toBe(levelStart(r.n));
    for (const xp of [0, 1, 499, 500, 1049, 1050, 20999, 21000, 22499, 22500, 138000, 500000]) {
      const { rows: l } = await db.query<{ level: number }>("select level_of($1) as level", [xp]);
      expect(l[0].level).toBe(levelOf(xp));
    }
    expect(levelOf(499)).toBe(1);
    expect(levelOf(500)).toBe(2);
    expect(levelStart(3)).toBe(1050); // 500 + 550
  });

  it("the reward track matches the rewards table", async () => {
    const { rows } = await db.query<{ id: string; kind: string; level: number; streak: number | null }>("select * from rewards order by id");
    const fromApp = REWARDS.map((r) => ({ id: r.id, kind: r.kind, level: r.level, streak: "streak" in r ? (r.streak ?? null) : null }));
    expect(rows).toEqual(fromApp.sort((a, b) => a.id.localeCompare(b.id)));
  });
});

describe("earning XP", () => {
  it("+100 for a finish, +50 more before 9 AM local time", async () => {
    const me = await person("earner");
    expect(await finish(me, await block(me, at("2026-10-14", 14)), at("2026-10-14", 14, 30))).toBe(100);
    expect(await finish(me, await block(me, at("2026-10-15", 7)), at("2026-10-15", 8, 59))).toBe(150 + streakBonus(2));
  });

  it("consistency: the first finish of each day pays +20 per streak day (max 200)", async () => {
    const me = await person("streaker");
    const days = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const xp = [];
    for (const d of days) xp.push(await finish(me, await block(me, at(d, 12)), at(d, 12, 30)));
    expect(xp).toEqual([100, 140, 160]); // day 1: none, day 2: +40, day 3: +60
    // A second finish the same day gets no second bonus.
    expect(await finish(me, await block(me, at("2026-09-03", 15)), at("2026-09-03", 15, 30))).toBe(100);
    expect(streakBonus(12)).toBe(200);
  });

  it("only the first 10 finished blocks a day earn XP", async () => {
    const me = await person("farmer");
    const xp = [];
    for (let i = 0; i < 11; i++) xp.push(await finish(me, await block(me, at("2026-10-01", 0, i * 35)), at("2026-10-01", 12, i)));
    expect(xp.slice(0, 10).every((x) => x >= 100)).toBe(true);
    expect(xp[10]).toBe(0);
  });

  it("users can't award themselves XP", async () => {
    const me = await person("cheater");
    const b = await block(me, at("2026-10-02", 12));
    await expect(asUser(db, me, (tx) => tx.query("select award_completion($1, $2, now())", [me, b]))).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, me, (tx) => tx.query("insert into points_ledger (user_id, points, reason) values ($1, 1000, 'gift')", [me])),
    ).rejects.toThrow(/permission denied|row-level security/);
  });

  it("undoing a finish takes its XP back", async () => {
    const me = await person("undoer");
    const b = await block(me, at("2026-10-03", 7));
    await finish(me, b, at("2026-10-03", 7, 30));
    expect(await total(me)).toBe(150);
    await asUser(db, me, (tx) => tx.query("select uncomplete_block($1)", [b]));
    expect(await total(me)).toBe(0);
  });
});

describe("missing blocks", () => {
  it("-50 XP once per missed block; skipped and long-ago blocks don't count", async () => {
    const me = await person("misser");
    for (let i = 0; i < 6; i++) await finish(me, await block(me, at("2026-10-10", 0, i * 35)), at("2026-10-10", 13, i)); // 600 XP, level 2
    await block(me, at("2026-10-14", 9)); // missed
    const skipped = await block(me, at("2026-10-14", 11));
    await db.query("update blocks set status = 'skipped' where id = $1", [skipped]);
    await block(me, at("2026-09-01", 9)); // ended long ago (grace period)
    await block(me, at("2026-10-14", 20)); // hasn't ended yet

    expect(await sweep(me, at("2026-10-14", 18))).toEqual({ missed: 1, xp_lost: 50 });
    expect(await total(me)).toBe(550);
    expect(await sweep(me, at("2026-10-14", 18, 5))).toEqual({ missed: 0, xp_lost: 0 }); // only once
  });

  it("never drops you below the start of your level", async () => {
    const me = await person("floor");
    for (let i = 0; i < 5; i++) await finish(me, await block(me, at("2026-10-11", 0, i * 35)), at("2026-10-11", 14, i)); // 500 = level 2 exactly... plus streak
    const before = await total(me);
    await block(me, at("2026-10-13", 9));
    await block(me, at("2026-10-13", 10));
    await sweep(me, at("2026-10-13", 18));
    const after = await total(me);
    expect(levelOf(after)).toBe(levelOf(before));
    expect(after).toBeGreaterThanOrEqual(levelStart(levelOf(before)));
  });

  it("finishing a missed block late cancels the penalty", async () => {
    const me = await person("latecomer");
    await finish(me, await block(me, at("2026-10-12", 8)), at("2026-10-12", 10)); // 100
    const late = await block(me, at("2026-10-13", 9));
    await sweep(me, at("2026-10-13", 18));
    expect(await total(me)).toBe(50);
    await finish(me, late, at("2026-10-13", 19));
    expect(await total(me)).toBe(100 + 100 + streakBonus(2));
  });
});

describe("rewards and leaderboard", () => {
  it("you can only equip what you've unlocked", async () => {
    const me = await person("equipper");
    await expect(asUser(db, me, (tx) => tx.query("update user_settings set flame_style = 'gold' where user_id = $1", [me]))).rejects.toThrow(/reward_locked/);
    await expect(asUser(db, me, (tx) => tx.query("update user_settings set title = 'mythic' where user_id = $1", [me]))).rejects.toThrow(/reward_locked/);
    await asUser(db, me, (tx) => tx.query("update user_settings set title = 'rookie', flame_style = 'classic' where user_id = $1", [me]));
    // 1,050 XP = level 3: "Planner" unlocks.
    await db.query("insert into points_ledger (user_id, points, reason) values ($1, 1000, 'test'), ($1, 50, 'test')", [me]);
    await asUser(db, me, (tx) => tx.query("update user_settings set title = 'planner' where user_id = $1", [me]));
  });

  it("the leaderboard shows you and your friends (not strangers), ranked by this week's XP", async () => {
    const me = await person("leader_me");
    const friend = await person("leader_friend");
    const stranger = await person("leader_stranger");
    await db.query("insert into friendships (requester_id, addressee_id, status, accepted_at) values ($1, $2, 'accepted', now())", [me, friend]);
    await db.query(
      "insert into points_ledger (user_id, points, reason, created_at) values ($1, 300, 'test', now()), ($2, 500, 'test', now()), ($2, 900, 'test', now() - interval '30 days'), ($3, 999, 'test', now())",
      [me, friend, stranger],
    );
    const rows = await asUser(db, me, async (tx) =>
      (await tx.query<{ display_name: string; week_xp: number; total_xp: number; level: number; is_me: boolean }>(
        "select display_name, week_xp, total_xp, level, is_me from friends_leaderboard(now() - interval '7 days')",
      )).rows,
    );
    expect(rows).toEqual([
      { display_name: "leader_friend", week_xp: 500, total_xp: 1400, level: levelOf(1400), is_me: false },
      { display_name: "leader_me", week_xp: 300, total_xp: 300, level: 1, is_me: true },
    ]);
  });
});
