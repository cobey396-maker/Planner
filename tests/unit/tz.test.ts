import { describe, expect, it } from "vitest";
import { addDays, dayKey, dayRange, isoWeekday, minuteOfDay, startOfWeek, zonedTimeToUtc } from "@/lib/tz";

const CHI = "America/Chicago";
const iso = (ms: number) => new Date(ms).toISOString();

describe("time zone helpers", () => {
  it("finds the local day and minute of an instant", () => {
    const t = Date.parse("2026-10-15T03:30:00Z"); // 10:30 PM on Oct 14 in Chicago
    expect(dayKey(t, CHI)).toBe("2026-10-14");
    expect(dayKey(t, "UTC")).toBe("2026-10-15");
    expect(minuteOfDay(t, CHI)).toBe(22 * 60 + 30);
  });

  it("converts local wall-clock time to the right instant on both sides of DST", () => {
    expect(iso(zonedTimeToUtc("2026-10-26", 18 * 60, CHI))).toBe("2026-10-26T23:00:00.000Z"); // CDT, UTC-5
    expect(iso(zonedTimeToUtc("2026-11-02", 18 * 60, CHI))).toBe("2026-11-03T00:00:00.000Z"); // CST, UTC-6
    expect(iso(zonedTimeToUtc("2026-07-01", 9 * 60, "Asia/Kolkata"))).toBe("2026-07-01T03:30:00.000Z"); // +5:30
  });

  it("rolls a non-existent spring-forward time forward instead of breaking", () => {
    // Clocks jump 2:00 → 3:00 AM on Mar 14 2027 in Chicago.
    expect(iso(zonedTimeToUtc("2027-03-14", 2 * 60 + 30, CHI))).toBe("2027-03-14T08:30:00.000Z");
  });

  it("knows DST days are 23 or 25 hours long", () => {
    const hours = (key: string) => {
      const r = dayRange(key, CHI);
      return (r.end - r.start) / 3_600_000;
    };
    expect(hours("2026-10-14")).toBe(24);
    expect(hours("2026-11-01")).toBe(25); // fall back
    expect(hours("2027-03-14")).toBe(23); // spring forward
  });

  it("does calendar math on day keys, including month and leap-year edges", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("finds the start of the week for Monday- and Sunday-start weeks", () => {
    expect(isoWeekday("2026-10-14")).toBe(3); // Wednesday
    expect(startOfWeek("2026-10-14", 1)).toBe("2026-10-12"); // Monday
    expect(startOfWeek("2026-10-14", 7)).toBe("2026-10-11"); // Sunday
    expect(startOfWeek("2026-10-18", 1)).toBe("2026-10-12"); // a Sunday, Monday-start week
    expect(startOfWeek("2026-10-18", 7)).toBe("2026-10-18");
  });
});
