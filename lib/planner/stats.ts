import { addDays, dayKey, minuteOfDay, startOfWeek } from "@/lib/tz";
import type { PlannedBlock } from "./types";

/**
 * STREAKS, RECAP AND BADGES: all computed from the user's real blocks.
 * Pure functions (no React, no database), so every rule is unit-tested.
 */

export const POINTS_PER_BLOCK = 10;
/** The flame turns purple from this many days on. */
export const PURPLE_FLAME_STREAK = 10;

/** Local days on which at least one block was completed. */
export function completionDays(blocks: PlannedBlock[], timeZone: string): Set<string> {
  const days = new Set<string>();
  for (const b of blocks) if (b.status === "done" && b.completedAt) days.add(dayKey(b.completedAt, timeZone));
  return days;
}

/**
 * Consecutive days with a completion, ending today. If you haven't finished
 * anything YET today, yesterday's streak still counts (you have until
 * midnight), so the streak doesn't flash to 0 every morning.
 */
export function currentStreak(days: Set<string>, today: string): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function bestStreak(days: Set<string>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 1;
    while (days.has(addDays(day, length))) length++;
    best = Math.max(best, length);
  }
  return best;
}

export type DayRecap = { day: string; due: number; done: number; rate: number | null };

/**
 * How much of the plan got done, per day of a week. A block counts as "due"
 * once its start time has passed; future blocks don't drag the score down.
 * rate is null when nothing was due that day (no data, not 0%).
 */
export function weekRecap(blocks: PlannedBlock[], weekStart: string, timeZone: string, now: number) {
  const days: DayRecap[] = Array.from({ length: 7 }, (_, i) => ({ day: addDays(weekStart, i), due: 0, done: 0, rate: null }));
  const index = new Map(days.map((d, i) => [d.day, i]));
  for (const b of blocks) {
    const i = index.get(dayKey(b.startsAt, timeZone));
    if (i === undefined || b.status === "skipped") continue;
    if (b.startsAt > now && b.status !== "done") continue;
    days[i].due++;
    if (b.status === "done") days[i].done++;
  }
  for (const d of days) d.rate = d.due ? d.done / d.due : null;
  const due = days.reduce((s, d) => s + d.due, 0);
  const done = days.reduce((s, d) => s + d.done, 0);
  return { days, due, done, rate: due ? done / due : null };
}

export type BadgeId = "early_bird" | "on_fire" | "deep_work" | "perfect_week" | "study_buddy" | "legend";

export const BADGES: { id: BadgeId; emoji: string; name: string; detail: string }[] = [
  { id: "early_bird", emoji: "🌅", name: "Early bird", detail: "Finish a block before 9 AM" },
  { id: "on_fire", emoji: "🔥", name: "On fire", detail: "Reach a 7-day streak" },
  { id: "deep_work", emoji: "🧠", name: "Deep work", detail: "Finish 3 hours of blocks in one day" },
  { id: "perfect_week", emoji: "💯", name: "Perfect week", detail: "Finish every block in a week (5+)" },
  { id: "study_buddy", emoji: "🤝", name: "Study buddy", detail: "Make plans with a friend" },
  { id: "legend", emoji: "🏆", name: "Legend", detail: "Reach a 30-day streak" },
];

export function earnedBadges(
  blocks: PlannedBlock[],
  timeZone: string,
  weekStartsOn: 1 | 7,
  hasAcceptedHangout: boolean,
): Set<BadgeId> {
  const earned = new Set<BadgeId>();
  const done = blocks.filter((b) => b.status === "done" && b.completedAt);

  if (done.some((b) => minuteOfDay(b.completedAt!, timeZone) < 9 * 60)) earned.add("early_bird");

  const best = bestStreak(completionDays(blocks, timeZone));
  if (best >= 7) earned.add("on_fire");
  if (best >= 30) earned.add("legend");

  const minutesByDay = new Map<string, number>();
  for (const b of done) {
    const key = dayKey(b.completedAt!, timeZone);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + (b.endsAt - b.startsAt) / 60_000);
  }
  if ([...minutesByDay.values()].some((m) => m >= 180)) earned.add("deep_work");

  const weeks = new Map<string, { total: number; done: number }>();
  for (const b of blocks) {
    if (b.status === "skipped") continue;
    const week = startOfWeek(dayKey(b.startsAt, timeZone), weekStartsOn);
    const w = weeks.get(week) ?? { total: 0, done: 0 };
    w.total++;
    if (b.status === "done") w.done++;
    weeks.set(week, w);
  }
  if ([...weeks.values()].some((w) => w.total >= 5 && w.done === w.total)) earned.add("perfect_week");

  if (hasAcceptedHangout) earned.add("study_buddy");
  return earned;
}
