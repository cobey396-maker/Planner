import { describe, expect, it } from "vitest";
import { MAX_OCCURRENCES, placeMany } from "@/lib/planner/placement";
import { describeRepeat, expandRepeat } from "@/lib/planner/repeat";
import { zonedTimeToUtc } from "@/lib/tz";

const TZ = "America/Chicago";
const at = (day: string, h: number, m = 0) => zonedTimeToUtc(day, h * 60 + m, TZ);
const local = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);

describe("expandRepeat", () => {
  // 2026-10-19 is a Monday.
  it("gym every Monday, Thursday and Friday for two weeks", () => {
    expect(expandRepeat({ kind: "weekly", weekdays: [1, 4, 5] }, "2026-10-19", "2026-11-01")).toEqual([
      "2026-10-19", "2026-10-22", "2026-10-23", "2026-10-26", "2026-10-29", "2026-10-30",
    ]);
  });

  it("every day, and weekdays only", () => {
    expect(expandRepeat({ kind: "daily" }, "2026-10-19", "2026-10-25")).toHaveLength(7);
    expect(expandRepeat({ kind: "weekdays" }, "2026-10-19", "2026-10-25")).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23",
    ]);
  });

  it("crosses month and year boundaries and is capped", () => {
    expect(expandRepeat({ kind: "weekly", weekdays: [4] }, "2026-12-20", "2027-01-10")).toEqual(["2026-12-24", "2026-12-31", "2027-01-07"]);
    expect(expandRepeat({ kind: "daily" }, "2026-01-01", "2027-12-31")).toHaveLength(MAX_OCCURRENCES);
  });

  it("describes rules in plain English", () => {
    expect(describeRepeat({ kind: "weekly", weekdays: [5, 1, 4] })).toBe("every Mon, Thu & Fri");
    expect(describeRepeat({ kind: "weekly", weekdays: [3] })).toBe("every Wednesday");
    expect(describeRepeat({ kind: "weekdays" })).toBe("every weekday");
  });
});

describe("placeMany", () => {
  const now = at("2026-10-18", 12);

  it("puts the same task at 5 PM on every chosen day, including after DST ends", () => {
    // US clocks fall back on Nov 1 2026; 5 PM must stay 5 PM local.
    const days = expandRepeat({ kind: "weekly", weekdays: [1, 4, 5] }, "2026-10-19", "2026-11-06");
    const { placed, skipped } = placeMany({ dayKeys: days, minutes: 60, startMinute: 17 * 60, timeZone: TZ, now, busy: [] });
    expect(skipped).toEqual([]);
    expect(placed.map((p) => local(p.startsAt))).toEqual([
      "Mon, Oct 19, 5:00 PM", "Thu, Oct 22, 5:00 PM", "Fri, Oct 23, 5:00 PM",
      "Mon, Oct 26, 5:00 PM", "Thu, Oct 29, 5:00 PM", "Fri, Oct 30, 5:00 PM",
      "Mon, Nov 2, 5:00 PM", "Thu, Nov 5, 5:00 PM", "Fri, Nov 6, 5:00 PM",
    ]);
  });

  it("skips a day that's taken instead of failing everything", () => {
    const busy = [{ start: at("2026-10-22", 16, 30), end: at("2026-10-22", 18) }];
    const { placed, skipped } = placeMany({
      dayKeys: ["2026-10-19", "2026-10-22", "2026-10-23"], minutes: 60, startMinute: 17 * 60, timeZone: TZ, now, busy,
    });
    expect(placed.map((p) => p.dayKey)).toEqual(["2026-10-19", "2026-10-23"]);
    expect(skipped).toEqual([{ dayKey: "2026-10-22", error: "That time is already taken." }]);
  });

  it("auto placement on several days, and past days are skipped", () => {
    const { placed, skipped } = placeMany({
      dayKeys: ["2026-10-17", "2026-10-20", "2026-10-21"], minutes: 30, startMinute: null, timeZone: TZ, now, busy: [],
    });
    expect(placed.map((p) => local(p.startsAt))).toEqual(["Tue, Oct 20, 8:00 AM", "Wed, Oct 21, 8:00 AM"]);
    expect(skipped.map((s) => s.dayKey)).toEqual(["2026-10-17"]);
  });
});
