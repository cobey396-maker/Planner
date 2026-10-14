import type { Interval } from "./types";

/**
 * FREE-TIME MATH
 * ==============
 * Used by Friends (shared free time) and, temporarily, by the Add Task sheet
 * to find a slot. The real auto-planner (Phase 5) builds on the same ideas.
 */

/**
 * Merge overlapping or touching intervals into the smallest sorted set.
 *   [9–10, 9:30–11, 13–14]  →  [9–11, 13–14]
 * Classic algorithm: sort by start, then walk once, extending the last
 * merged interval whenever the next one overlaps it. O(n log n) for the sort.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/**
 * The gaps between busy intervals inside [dayStart, dayEnd), keeping only
 * gaps of at least `minLength` minutes.
 */
export function freeWindows(
  busy: Interval[],
  dayStart: number,
  dayEnd: number,
  minLength = 30,
): Interval[] {
  const free: Interval[] = [];
  let cursor = dayStart;
  for (const b of mergeIntervals(busy)) {
    if (b.end <= dayStart || b.start >= dayEnd) continue;
    if (b.start - cursor >= minLength) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd - cursor >= minLength) free.push({ start: cursor, end: dayEnd });
  return free;
}

/**
 * Time when BOTH people are free. Key insight: "free together" is just the
 * free windows of the union of both busy lists. And it only needs busy/free
 * spans, never event titles, which is how we protect friends' privacy.
 */
export function sharedFreeWindows(
  mine: Interval[],
  theirs: Interval[],
  dayStart: number,
  dayEnd: number,
  minLength = 30,
): Interval[] {
  return freeWindows([...mine, ...theirs], dayStart, dayEnd, minLength);
}

/**
 * TEMPORARY stand-in for the real scheduler (Phase 5): put a task of
 * `minutes` length into the first free gap of the day that starts at or
 * after `notBefore`, aligned to 15 minutes. Returns null if nothing fits.
 */
export function firstFit(
  busy: Interval[],
  minutes: number,
  dayStart: number,
  dayEnd: number,
  notBefore = dayStart,
): Interval | null {
  const earliest = Math.ceil(Math.max(dayStart, notBefore) / 15) * 15;
  for (const w of freeWindows(busy, earliest, dayEnd, minutes)) {
    return { start: w.start, end: w.start + minutes };
  }
  return null;
}
