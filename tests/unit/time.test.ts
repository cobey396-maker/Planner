import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, mondayIndex, startOfWeek } from "@/lib/time";

describe("time helpers", () => {
  it("formats durations compactly", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(75)).toBe("1h 15m");
  });

  it("formats minutes-since-midnight as a clock time", () => {
    expect(formatClock(570, "en-US")).toBe("9:30 AM");
    expect(formatClock(1320, "en-US")).toBe("10:00 PM");
  });

  it("numbers weekdays from Monday", () => {
    expect(mondayIndex(new Date(2026, 9, 12))).toBe(0); // Mon Oct 12 2026
    expect(mondayIndex(new Date(2026, 9, 18))).toBe(6); // Sun Oct 18 2026
  });

  it("finds the Monday of the week, even from a Sunday", () => {
    const monday = startOfWeek(new Date(2026, 9, 18, 15, 30));
    expect([monday.getFullYear(), monday.getMonth(), monday.getDate(), monday.getHours()]).toEqual([2026, 9, 12, 0]);
  });
});
