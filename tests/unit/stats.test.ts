import { describe, expect, it } from "vitest";
import { BADGES, bestStreak, completionDays, currentStreak, earnedBadges, weekRecap, type BadgeId } from "@/lib/planner/stats";
import type { PlannedBlock } from "@/lib/planner/types";
import { addDays, zonedTimeToUtc } from "@/lib/tz";

const TZ = "America/Chicago";
let id = 0;
/** A block on a local day/time; done blocks are completed at their end time. */
function block(
  day: string,
  startMin: number,
  minutes: number,
  status: PlannedBlock["status"] = "planned",
  extra: Partial<PlannedBlock> = {},
): PlannedBlock {
  const startsAt = zonedTimeToUtc(day, startMin, TZ);
  const endsAt = startsAt + minutes * 60_000;
  id++;
  return { id: `b${id}`, taskId: `t${id}`, title: "x", color: "blue", startsAt, endsAt, status, completedAt: status === "done" ? endsAt : null, ...extra };
}

describe("streaks", () => {
  it("a brand-new account has a 0 streak", () => {
    expect(currentStreak(completionDays([], TZ), "2026-10-14")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(currentStreak(days, "2026-10-14")).toBe(3);
  });

  it("keeps yesterday's streak alive until today is over", () => {
    const days = new Set(["2026-10-12", "2026-10-13"]);
    expect(currentStreak(days, "2026-10-14")).toBe(2);
  });

  it("resets after a missed day", () => {
    const days = new Set(["2026-10-10", "2026-10-11", "2026-10-13"]);
    expect(currentStreak(days, "2026-10-15")).toBe(0);
    expect(bestStreak(days)).toBe(2);
  });

  it("uses the user's time zone: 11 PM Chicago is still 'today' there", () => {
    const late = block("2026-10-14", 23 * 60, 30, "done"); // completes 11:30 PM CDT = 04:30Z next day
    expect([...completionDays([late], TZ)]).toEqual(["2026-10-14"]);
  });
});

describe("weekly recap", () => {
  const now = zonedTimeToUtc("2026-10-14", 12 * 60, TZ); // Wednesday noon
  it("only counts blocks whose time has come, so future plans don't lower the score", () => {
    const blocks = [
      block("2026-10-12", 9 * 60, 60, "done"),
      block("2026-10-13", 9 * 60, 60, "planned"), // missed
      block("2026-10-14", 9 * 60, 60, "done"),
      block("2026-10-14", 18 * 60, 60, "planned"), // later today: not due yet
      block("2026-10-16", 9 * 60, 60, "planned"), // Friday: not due
    ];
    const recap = weekRecap(blocks, "2026-10-12", TZ, now);
    expect(recap.due).toBe(3);
    expect(recap.done).toBe(2);
    expect(recap.rate).toBeCloseTo(2 / 3);
    expect(recap.days.map((d) => d.rate)).toEqual([1, 0, 1, null, null, null, null]);
  });

  it("is null (not 0%) for an empty week", () => {
    expect(weekRecap([], "2026-10-12", TZ, now).rate).toBeNull();
  });
});

describe("badges", () => {
  const NOW = zonedTimeToUtc("2026-10-18", 12 * 60, TZ);
  const ctx = { timeZone: TZ, weekStartsOn: 1 as const, hasAcceptedHangout: false, friendsCount: 0, now: NOW };
  const earned = (blocks: PlannedBlock[], extra: Partial<typeof ctx> = {}) => [...earnedBadges(blocks, { ...ctx, ...extra })].sort();
  const has = (blocks: PlannedBlock[], badge: BadgeId, extra: Partial<typeof ctx> = {}) => earnedBadges(blocks, { ...ctx, ...extra }).has(badge);
  /** n consecutive days from `start`, one finished 30-min block at noon each. */
  const run = (start: string, n: number) => Array.from({ length: n }, (_, i) => block(addDays(start, i), 12 * 60, 30, "done"));
  /** n finished blocks spread one per day (so only count-based badges apply). */
  const many = (n: number) => Array.from({ length: n }, (_, i) => block(addDays("2025-01-01", i * 2), 12 * 60, 30, "done"));

  it("there are 31 badges with unique ids, and a new account has none", () => {
    expect(BADGES).toHaveLength(31);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(31);
    expect(earned([])).toEqual([]);
  });

  it("planned (unfinished) blocks never earn finishing badges", () => {
    expect(earned([block("2026-10-14", 5 * 60, 180)])).toEqual([]);
  });

  it("count badges: first step, 10, 50, 100", () => {
    expect(earned(many(1))).toEqual(["first_step"]);
    expect(has(many(9), "getting_started")).toBe(false);
    expect(has(many(10), "getting_started")).toBe(true);
    expect(has(many(49), "half_century")).toBe(false);
    expect(has(many(50), "half_century")).toBe(true);
    expect(has(many(99), "centurion")).toBe(false);
    expect(has(many(100), "centurion")).toBe(true);
  });

  it("Colorful: 5 different colors finished", () => {
    const colors = ["blue", "green", "red", "pink", "teal"] as const;
    const blocks = colors.map((color, i) => block(addDays("2026-10-01", i * 2), 12 * 60, 30, "done", { color }));
    expect(has(blocks.slice(0, 4), "colorful")).toBe(false);
    expect(has(blocks, "colorful")).toBe(true);
  });

  it("streak badges at 7, 10, 21, 30 and 100 days", () => {
    const streakIds = ["on_fire", "purple_flame", "habit_formed", "legend", "century_streak"];
    const streakBadges = (n: number) => earned(run("2026-01-01", n)).filter((b) => streakIds.includes(b));
    expect(streakBadges(6)).toEqual([]);
    expect(streakBadges(7)).toEqual(["on_fire"]);
    expect(streakBadges(10)).toEqual(["on_fire", "purple_flame"]);
    expect(streakBadges(20)).toEqual(["on_fire", "purple_flame"]);
    expect(streakBadges(21)).toEqual(["habit_formed", "on_fire", "purple_flame"]);
    expect(streakBadges(30)).toHaveLength(4);
    expect(streakBadges(99)).toHaveLength(4);
    expect(streakBadges(100)).toHaveLength(5);
  });

  it("Comeback kid: a 3+ day streak broken, then a new one started", () => {
    expect(has(run("2026-10-01", 3), "comeback_kid")).toBe(false);
    expect(has([...run("2026-10-01", 3), ...run("2026-10-06", 1)], "comeback_kid")).toBe(true);
    // A short (2-day) run that broke doesn't count.
    expect(has([...run("2026-10-01", 2), ...run("2026-10-06", 1)], "comeback_kid")).toBe(false);
  });

  it("Hat trick (3 in a day) and High five (5 in a day)", () => {
    const day = (n: number) => Array.from({ length: n }, (_, i) => block("2026-10-14", 12 * 60 + i * 30, 30, "done"));
    expect(has(day(2), "hat_trick")).toBe(false);
    expect(has(day(3), "hat_trick")).toBe(true);
    expect(has(day(4), "high_five")).toBe(false);
    expect(has(day(5), "high_five")).toBe(true);
  });

  it("In the zone: one finished block of 2+ hours", () => {
    expect(has([block("2026-10-14", 12 * 60, 119, "done")], "focus_hour")).toBe(false);
    expect(has([block("2026-10-14", 12 * 60, 120, "done")], "focus_hour")).toBe(true);
  });

  it("Deep work at 3h and Marathon day at 6h finished in one day", () => {
    const day = (hours: number) => Array.from({ length: hours }, (_, i) => block("2026-10-14", 10 * 60 + i * 60, 60, "done"));
    expect(has(day(2), "deep_work")).toBe(false);
    expect(has(day(3), "deep_work")).toBe(true);
    expect(has(day(5), "marathon_day")).toBe(false);
    expect(has(day(6), "marathon_day")).toBe(true);
  });

  it("10- and 20-hour weeks count finished time inside one week", () => {
    // Mon Oct 12 to Sun Oct 18: 2 hours a day.
    const week = (perDay: number) =>
      Array.from({ length: 7 }, (_, i) => block(addDays("2026-10-12", i), 12 * 60, perDay, "done"));
    expect(has(week(85), "ten_hour_week")).toBe(false); // 9h 55m
    expect(has(week(86), "ten_hour_week")).toBe(true);
    expect(has(week(171), "twenty_hour_week")).toBe(false);
    expect(has(week(172), "twenty_hour_week")).toBe(true);
  });

  it("time of day: dawn patrol (<6 AM), early bird (<9 AM), night owl (10 PM+)", () => {
    expect(earned([block("2026-10-14", 5 * 60, 30, "done")])).toEqual(["dawn_patrol", "early_bird", "first_step"]);
    expect(earned([block("2026-10-14", 7 * 60, 60, "done")])).toEqual(["early_bird", "first_step"]);
    expect(earned([block("2026-10-14", 8 * 60, 60, "done")])).toEqual(["first_step"]); // finished exactly 9:00
    expect(earned([block("2026-10-14", 21 * 60 + 30, 30, "done")])).toEqual(["first_step", "night_owl"]);
  });

  it("Weekend warrior: a Saturday and the Sunday right after", () => {
    expect(has([...run("2026-10-17", 2)], "weekend_warrior")).toBe(true); // Sat + Sun
    expect(has([...run("2026-10-18", 2)], "weekend_warrior")).toBe(false); // Sun + Mon
  });

  it("Right on time: 10 blocks finished by their end time", () => {
    const late = (b: PlannedBlock) => ({ ...b, completedAt: b.endsAt + 60_000 });
    expect(has(many(9), "punctual")).toBe(false);
    expect(has(many(10), "punctual")).toBe(true);
    expect(has(many(10).map(late), "punctual")).toBe(false);
  });

  it("Creature of habit (a task with 4+ blocks) and Consistency (4 of them done)", () => {
    const series = Array.from({ length: 4 }, (_, i) => block(addDays("2026-10-19", i * 7), 17 * 60, 60, "planned", { taskId: "gym" }));
    expect(has(series.slice(0, 3), "creature_of_habit")).toBe(false);
    expect(has(series, "creature_of_habit")).toBe(true);
    expect(has(series, "consistency")).toBe(false);
    const done = series.map((b) => ({ ...b, status: "done" as const, completedAt: b.endsAt }));
    expect(has(done, "consistency")).toBe(true);
  });

  it("Full week: something planned on all 7 days of one week", () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => block(addDays("2026-10-19", i), 9 * 60, 30));
    expect(has(days(6), "full_week")).toBe(false);
    expect(has(days(7), "full_week")).toBe(true);
    // 7 days that straddle two weeks don't count.
    expect(has(Array.from({ length: 7 }, (_, i) => block(addDays("2026-10-21", i), 9 * 60, 30)), "full_week")).toBe(false);
  });

  it("Perfect week: every block in a week of 5+ done", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].map((d) => block(d, 12 * 60, 30, "done"));
    expect(has(week, "perfect_week")).toBe(true);
    expect(has([...week, block("2026-10-17", 12 * 60, 30, "planned")], "perfect_week")).toBe(false);
  });

  it("Perfect month: a finished month with 20+ blocks, all done", () => {
    const september = Array.from({ length: 20 }, (_, i) => block(addDays("2026-09-01", i), 12 * 60, 30, "done"));
    expect(has(september, "perfect_month")).toBe(true);
    expect(has(september.slice(0, 19), "perfect_month")).toBe(false);
    expect(has([...september, block("2026-09-30", 18 * 60, 30, "planned")], "perfect_month")).toBe(false);
    // The current month (October) can't earn it until it's over.
    const october = Array.from({ length: 20 }, (_, i) => block(addDays("2026-10-01", i % 17), 6 * 60 + i * 30, 30, "done"));
    expect(has(october, "perfect_month")).toBe(false);
  });

  it("friend badges: plans with a friend, 3 friends, 10 friends", () => {
    expect(earned([], { hasAcceptedHangout: true })).toEqual(["study_buddy"]);
    expect(earned([], { friendsCount: 2 })).toEqual([]);
    expect(earned([], { friendsCount: 3 })).toEqual(["social_butterfly"]);
    expect(earned([], { friendsCount: 10 })).toEqual(["social_butterfly", "squad"]);
  });
});
