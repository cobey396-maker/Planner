import { describe, expect, it } from "vitest";
import { placeTask } from "@/lib/planner/placement";
import { zonedTimeToUtc } from "@/lib/tz";

const TZ = "America/Chicago";
const at = (day: string, h: number, m = 0) => zonedTimeToUtc(day, h * 60 + m, TZ);
const local = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" }).format(ms);

describe("placeTask", () => {
  const now = at("2026-10-14", 10, 7);

  it("today, auto: the first open slot from now (rounded up)", () => {
    const r = placeTask({ dayKey: "2026-10-14", minutes: 60, startMinute: null, timeZone: TZ, now, busy: [] });
    expect(r.ok && local(r.startsAt)).toBe("Wed 10:15 AM");
  });

  it("skips over existing blocks", () => {
    const busy = [{ start: at("2026-10-14", 10, 15), end: at("2026-10-14", 12) }];
    const r = placeTask({ dayKey: "2026-10-14", minutes: 60, startMinute: null, timeZone: TZ, now, busy });
    expect(r.ok && local(r.startsAt)).toBe("Wed 12:00 PM");
  });

  it("other days, auto: starts looking at 8 AM, not 3 AM", () => {
    const r = placeTask({ dayKey: "2026-10-16", minutes: 30, startMinute: null, timeZone: TZ, now, busy: [] });
    expect(r.ok && local(r.startsAt)).toBe("Fri 8:00 AM");
  });

  it("planning is 24/7: a late-night task still fits", () => {
    const late = at("2026-10-14", 22, 50);
    const r = placeTask({ dayKey: "2026-10-14", minutes: 60, startMinute: null, timeZone: TZ, now: late, busy: [] });
    expect(r.ok && local(r.startsAt)).toBe("Wed 11:00 PM");
  });

  it("an exact time works when it's free, and explains when it isn't", () => {
    const ok = placeTask({ dayKey: "2026-10-15", minutes: 60, startMinute: 18 * 60, timeZone: TZ, now, busy: [] });
    expect(ok.ok && local(ok.startsAt)).toBe("Thu 6:00 PM");
    const busy = [{ start: at("2026-10-15", 18, 30), end: at("2026-10-15", 19) }];
    expect(placeTask({ dayKey: "2026-10-15", minutes: 60, startMinute: 18 * 60, timeZone: TZ, now, busy })).toEqual({
      ok: false,
      error: "That time is already taken.",
    });
    expect(placeTask({ dayKey: "2026-10-14", minutes: 30, startMinute: 9 * 60, timeZone: TZ, now, busy: [] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already passed/),
    });
    expect(placeTask({ dayKey: "2026-10-15", minutes: 120, startMinute: 23 * 60, timeZone: TZ, now, busy: [] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/past midnight/),
    });
  });

  it("refuses days that are over", () => {
    expect(placeTask({ dayKey: "2026-10-13", minutes: 30, startMinute: null, timeZone: TZ, now, busy: [] })).toMatchObject({ ok: false });
  });

  it("stays correct on the 25-hour daylight-saving day", () => {
    const r = placeTask({ dayKey: "2026-11-01", minutes: 60, startMinute: 18 * 60, timeZone: TZ, now, busy: [] });
    expect(r.ok && new Date(r.startsAt).toISOString()).toBe("2026-11-02T00:00:00.000Z"); // 6 PM CST
  });
});
