import { describe, expect, it } from "vitest";
import { isUnlocked, levelOf, levelProgress, levelStart, REWARDS, rewardsBetween, streakBonus, xpForCompletion } from "@/lib/planner/levels";
import type { PlannedBlock } from "@/lib/planner/types";
import { addDays, zonedTimeToUtc } from "@/lib/tz";

const TZ = "America/Chicago";
const at = (day: string, h: number, m = 0) => zonedTimeToUtc(day, h * 60 + m, TZ);
let n = 0;
const done = (day: string, h: number): PlannedBlock => {
  n++;
  return { id: `b${n}`, taskId: `t${n}`, title: "x", color: "blue", startsAt: at(day, h), endsAt: at(day, h, 30), status: "done", completedAt: at(day, h, 30) };
};

describe("levels", () => {
  it("level 2 at 500 XP, each level costs 50 more, flat 1,500 from level 22", () => {
    expect([levelStart(1), levelStart(2), levelStart(3), levelStart(4)]).toEqual([0, 500, 1050, 1650]);
    expect(levelStart(23) - levelStart(22)).toBe(1500);
    expect(levelStart(50) - levelStart(49)).toBe(1500);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(1049)).toBe(2);
    expect(levelOf(10 ** 9)).toBe(200);
  });

  it("progress inside a level, for the bar", () => {
    expect(levelProgress(600)).toEqual({ level: 2, into: 100, needed: 550, fraction: 100 / 550, toNext: 450 });
  });

  it("rewards unlock by level; the purple flame also by a 10-day streak", () => {
    const purple = REWARDS.find((r) => r.id === "purple")!;
    expect(isUnlocked(purple, 14, 9)).toBe(false);
    expect(isUnlocked(purple, 15, 0)).toBe(true);
    expect(isUnlocked(purple, 1, 10)).toBe(true);
    expect(rewardsBetween(4, 5).map((r) => r.id)).toEqual(["blue"]);
  });
});

describe("xpForCompletion (mirrors the database)", () => {
  it("+100, +50 before 9 AM, streak bonus on the first finish of the day", () => {
    expect(xpForCompletion([], at("2026-10-14", 14), TZ)).toBe(100);
    expect(xpForCompletion([], at("2026-10-14", 8, 59), TZ)).toBe(150);
    const twoDays = [done("2026-10-12", 12), done("2026-10-13", 12)];
    expect(xpForCompletion(twoDays, at("2026-10-14", 14), TZ)).toBe(100 + streakBonus(3)); // 3-day streak: +60
    expect(xpForCompletion([...twoDays, done("2026-10-14", 10)], at("2026-10-14", 14), TZ)).toBe(100); // not the first today
  });

  it("only 10 finishes a day earn XP", () => {
    const ten = Array.from({ length: 10 }, (_, i) => done("2026-10-15", i + 8));
    expect(xpForCompletion(ten, at("2026-10-15", 20), TZ)).toBe(0);
    expect(xpForCompletion(ten.slice(1), at("2026-10-15", 20), TZ)).toBe(100);
  });

  it("the streak bonus caps at +200", () => {
    const month = Array.from({ length: 30 }, (_, i) => done(addDays("2026-09-01", i), 12));
    expect(xpForCompletion(month, at("2026-10-01", 12), TZ)).toBe(300);
  });
});
