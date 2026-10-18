import { describe, expect, it } from "vitest";
import { bestStreak, completionDays, currentStreak, earnedBadges, weekRecap } from "@/lib/planner/stats";
import type { PlannedBlock } from "@/lib/planner/types";
import { zonedTimeToUtc } from "@/lib/tz";

const TZ = "America/Chicago";
let id = 0;
/** A block on a local day/time; done blocks are completed at their end time. */
function block(day: string, startMin: number, minutes: number, status: PlannedBlock["status"] = "planned"): PlannedBlock {
  const startsAt = zonedTimeToUtc(day, startMin, TZ);
  const endsAt = startsAt + minutes * 60_000;
  return { id: `b${++id}`, taskId: "t", title: "x", color: "blue", startsAt, endsAt, status, completedAt: status === "done" ? endsAt : null };
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
  const earned = (blocks: PlannedBlock[], hangout = false) => [...earnedBadges(blocks, TZ, 1, hangout)].sort();

  it("a new account has none", () => {
    expect(earned([])).toEqual([]);
  });

  it("Early bird: a block finished before 9 AM local time", () => {
    expect(earned([block("2026-10-14", 7 * 60, 60, "done")])).toEqual(["early_bird"]);
    expect(earned([block("2026-10-14", 8 * 60, 60, "done")])).toEqual([]); // finished exactly 9:00
  });

  it("Deep work: 3+ hours finished in one day", () => {
    const day = [block("2026-10-14", 10 * 60, 90, "done"), block("2026-10-14", 13 * 60, 90, "done")];
    expect(earned(day)).toEqual(["deep_work"]);
    expect(earned([day[0]])).toEqual([]);
  });

  it("On fire at a 7-day streak, Legend at 30", () => {
    const run = (n: number) => Array.from({ length: n }, (_, i) => block(`2026-09-${String(i + 1).padStart(2, "0")}`, 12 * 60, 30, "done"));
    // (These runs also complete whole weeks, so "Perfect week" shows up too; only check streak badges.)
    const streakBadges = (n: number) => earned(run(n)).filter((b) => b === "on_fire" || b === "legend");
    expect(streakBadges(6)).toEqual([]);
    expect(streakBadges(7)).toEqual(["on_fire"]);
    expect(streakBadges(30)).toEqual(["legend", "on_fire"]);
  });

  it("Perfect week: every block in a week of 5+ done", () => {
    const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].map((d) => block(d, 12 * 60, 30, "done"));
    expect(earned(week)).toEqual(["perfect_week"]);
    expect(earned([...week, block("2026-10-17", 12 * 60, 30, "planned")])).toEqual([]);
  });

  it("Study buddy once a hangout is accepted", () => {
    expect(earned([], true)).toEqual(["study_buddy"]);
  });
});
