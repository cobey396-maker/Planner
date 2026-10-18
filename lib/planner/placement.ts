import { dayRange, zonedTimeToUtc } from "@/lib/tz";
import { firstFit } from "./free-time";
import type { Interval } from "./types";

/**
 * WHERE DOES A NEW TASK GO? (A simple placer; the real auto-planner that
 * considers deadlines and priorities comes in Phase 5.)
 *
 * Runs the same way on the server (real accounts) and in the browser (demo
 * mode). Works in "minutes since the start of that local day", measured in
 * real elapsed time, so it stays correct on 23- and 25-hour DST days.
 *
 * Planning is 24/7. When no time is picked, the task goes in the first open
 * slot from NOW (today) or from 8 AM (other days, so nothing lands at 3 AM).
 */
export const AUTO_START_MINUTE = 8 * 60;

export type PlacementRequest = {
  dayKey: string;
  minutes: number;
  /** Exact local start time (minutes after midnight), or null for "auto". */
  startMinute: number | null;
  timeZone: string;
  now: number;
  /** Existing blocks that day, as epoch-ms intervals. */
  busy: Interval[];
};

export type PlacementResult = { ok: true; startsAt: number; endsAt: number } | { ok: false; error: string };

export function placeTask(req: PlacementRequest): PlacementResult {
  const { start: dayStart, end: dayEnd } = dayRange(req.dayKey, req.timeZone);
  if (dayEnd <= req.now) return { ok: false, error: "That day is already over. Pick today or later." };

  const toMin = (ms: number) => Math.round((ms - dayStart) / 60_000);
  const dayLength = toMin(dayEnd);
  const busy = req.busy.map((b) => ({ start: toMin(b.start), end: toMin(b.end) }));
  // Never in the past. Round "now" up to the next 5 minutes.
  const nowMin = req.now > dayStart ? Math.ceil(toMin(req.now) / 5) * 5 : 0;

  if (req.startMinute !== null) {
    const start = toMin(zonedTimeToUtc(req.dayKey, req.startMinute, req.timeZone));
    const end = start + req.minutes;
    if (start < nowMin) return { ok: false, error: "That time has already passed." };
    if (end > dayLength) return { ok: false, error: "That would run past midnight. Pick an earlier time." };
    if (busy.some((b) => b.start < end && start < b.end)) return { ok: false, error: "That time is already taken." };
    return { ok: true, startsAt: dayStart + start * 60_000, endsAt: dayStart + end * 60_000 };
  }

  const autoFrom = req.now > dayStart ? nowMin : toMin(zonedTimeToUtc(req.dayKey, AUTO_START_MINUTE, req.timeZone));
  const slot = firstFit(busy, req.minutes, 0, dayLength, autoFrom);
  if (!slot) return { ok: false, error: "No open time left that day. Try another day or a shorter task." };
  return { ok: true, startsAt: dayStart + slot.start * 60_000, endsAt: dayStart + slot.end * 60_000 };
}
