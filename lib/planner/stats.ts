import { addDays, dayKey, isoWeekday, minuteOfDay, startOfWeek } from "@/lib/tz";
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

export type BadgeCategory = "Getting started" | "Streaks" | "Big days" | "Time of day" | "Habits" | "Friends";

export type Badge = { id: string; emoji: string; name: string; detail: string; category: BadgeCategory };

/**
 * Every badge, with the exact rule in `detail`. The rules live in
 * earnedBadges() below; each one is unit-tested in tests/unit/stats.test.ts.
 */
export const BADGES = [
  // Getting started
  { id: "first_step", emoji: "👣", name: "First step", detail: "Finish your first block", category: "Getting started" },
  { id: "getting_started", emoji: "🌱", name: "Getting going", detail: "Finish 10 blocks", category: "Getting started" },
  { id: "half_century", emoji: "🎯", name: "Half century", detail: "Finish 50 blocks", category: "Getting started" },
  { id: "centurion", emoji: "💪", name: "Centurion", detail: "Finish 100 blocks", category: "Getting started" },
  { id: "colorful", emoji: "🎨", name: "Colorful", detail: "Finish blocks in 5 different colors", category: "Getting started" },
  // Streaks
  { id: "on_fire", emoji: "🔥", name: "On fire", detail: "Reach a 7-day streak", category: "Streaks" },
  { id: "purple_flame", emoji: "💜", name: "Purple flame", detail: "Reach a 10-day streak", category: "Streaks" },
  { id: "habit_formed", emoji: "🧩", name: "Habit formed", detail: "Reach a 21-day streak", category: "Streaks" },
  { id: "legend", emoji: "🏆", name: "Legend", detail: "Reach a 30-day streak", category: "Streaks" },
  { id: "century_streak", emoji: "👑", name: "Unstoppable", detail: "Reach a 100-day streak", category: "Streaks" },
  { id: "comeback_kid", emoji: "🔁", name: "Comeback kid", detail: "Lose a 3+ day streak, then start again", category: "Streaks" },
  // Big days
  { id: "hat_trick", emoji: "🎩", name: "Hat trick", detail: "Finish 3 blocks in one day", category: "Big days" },
  { id: "high_five", emoji: "🖐️", name: "High five", detail: "Finish 5 blocks in one day", category: "Big days" },
  { id: "focus_hour", emoji: "🎧", name: "In the zone", detail: "Finish a block 2 hours or longer", category: "Big days" },
  { id: "deep_work", emoji: "🧠", name: "Deep work", detail: "Finish 3 hours of blocks in one day", category: "Big days" },
  { id: "marathon_day", emoji: "🏃", name: "Marathon day", detail: "Finish 6 hours of blocks in one day", category: "Big days" },
  { id: "ten_hour_week", emoji: "⏱️", name: "Ten-hour week", detail: "Finish 10 hours of blocks in one week", category: "Big days" },
  { id: "twenty_hour_week", emoji: "🚀", name: "Twenty-hour week", detail: "Finish 20 hours of blocks in one week", category: "Big days" },
  // Time of day
  { id: "dawn_patrol", emoji: "🌄", name: "Dawn patrol", detail: "Finish a block before 6 AM", category: "Time of day" },
  { id: "early_bird", emoji: "🌅", name: "Early bird", detail: "Finish a block before 9 AM", category: "Time of day" },
  { id: "night_owl", emoji: "🦉", name: "Night owl", detail: "Finish a block after 10 PM", category: "Time of day" },
  { id: "weekend_warrior", emoji: "🛡️", name: "Weekend warrior", detail: "Finish blocks on a Saturday and the Sunday after", category: "Time of day" },
  { id: "punctual", emoji: "⏰", name: "Right on time", detail: "Finish 10 blocks by their end time", category: "Time of day" },
  // Habits
  { id: "creature_of_habit", emoji: "🔂", name: "Creature of habit", detail: "Set up a task that repeats 4+ times", category: "Habits" },
  { id: "consistency", emoji: "📈", name: "Consistency", detail: "Finish the same repeating task 4 times", category: "Habits" },
  { id: "full_week", emoji: "🗓️", name: "Full week", detail: "Have something planned on all 7 days of a week", category: "Habits" },
  { id: "perfect_week", emoji: "💯", name: "Perfect week", detail: "Finish every block in a week (5+)", category: "Habits" },
  { id: "perfect_month", emoji: "🌕", name: "Perfect month", detail: "Finish every block in a calendar month (20+)", category: "Habits" },
  // Friends
  { id: "study_buddy", emoji: "🤝", name: "Study buddy", detail: "Make plans with a friend", category: "Friends" },
  { id: "social_butterfly", emoji: "🦋", name: "Social butterfly", detail: "Have 3 friends", category: "Friends" },
  { id: "squad", emoji: "👯", name: "Squad", detail: "Have 10 friends", category: "Friends" },
] as const satisfies readonly Badge[];

export type BadgeId = (typeof BADGES)[number]["id"];

export type BadgeContext = {
  timeZone: string;
  weekStartsOn: 1 | 7;
  hasAcceptedHangout: boolean;
  friendsCount: number;
  now: number;
};

/** Lengths of each run of consecutive days, oldest run first. */
function runs(days: Set<string>): number[] {
  const starts = [...days].filter((d) => !days.has(addDays(d, -1))).sort();
  return starts.map((start) => {
    let length = 1;
    while (days.has(addDays(start, length))) length++;
    return length;
  });
}

function countBy<T>(items: T[], key: (item: T) => string, weight: (item: T) => number = () => 1): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + weight(item));
  return map;
}

const max = (map: Map<string, number>) => Math.max(0, ...map.values());

export function earnedBadges(blocks: PlannedBlock[], ctx: BadgeContext): Set<BadgeId> {
  const { timeZone, weekStartsOn } = ctx;
  const earned = new Set<BadgeId>();
  const award = (id: BadgeId, when: boolean) => when && earned.add(id);

  const live = blocks.filter((b) => b.status !== "skipped");
  const done = live.filter((b) => b.status === "done" && b.completedAt !== null) as (PlannedBlock & { completedAt: number })[];
  const minutes = (b: PlannedBlock) => (b.endsAt - b.startsAt) / 60_000;
  const doneDay = (b: { completedAt: number }) => dayKey(b.completedAt, timeZone);

  // Getting started
  award("first_step", done.length >= 1);
  award("getting_started", done.length >= 10);
  award("half_century", done.length >= 50);
  award("centurion", done.length >= 100);
  award("colorful", new Set(done.map((b) => b.color)).size >= 5);

  // Streaks
  const days = completionDays(blocks, timeZone);
  const best = bestStreak(days);
  award("on_fire", best >= 7);
  award("purple_flame", best >= PURPLE_FLAME_STREAK);
  award("habit_formed", best >= 21);
  award("legend", best >= 30);
  award("century_streak", best >= 100);
  // Runs are separated by gaps, so any run after a 3+ day run is a comeback.
  const lengths = runs(days);
  award("comeback_kid", lengths.slice(0, -1).some((length) => length >= 3));

  // Big days
  const doneCount = countBy(done, doneDay);
  award("hat_trick", max(doneCount) >= 3);
  award("high_five", max(doneCount) >= 5);
  award("focus_hour", done.some((b) => minutes(b) >= 120));
  const doneMinutes = countBy(done, doneDay, minutes);
  award("deep_work", max(doneMinutes) >= 180);
  award("marathon_day", max(doneMinutes) >= 360);
  const weekMinutes = countBy(done, (b) => startOfWeek(doneDay(b), weekStartsOn), minutes);
  award("ten_hour_week", max(weekMinutes) >= 600);
  award("twenty_hour_week", max(weekMinutes) >= 1200);

  // Time of day
  const doneAt = done.map((b) => minuteOfDay(b.completedAt, timeZone));
  award("dawn_patrol", doneAt.some((m) => m < 6 * 60));
  award("early_bird", doneAt.some((m) => m < 9 * 60));
  award("night_owl", doneAt.some((m) => m >= 22 * 60));
  award("weekend_warrior", [...days].some((d) => isoWeekday(d) === 6 && days.has(addDays(d, 1))));
  award("punctual", done.filter((b) => b.completedAt <= b.endsAt).length >= 10);

  // Habits
  const blocksPerTask = countBy(live, (b) => b.taskId);
  award("creature_of_habit", max(blocksPerTask) >= 4);
  award("consistency", max(countBy(done, (b) => b.taskId)) >= 4);

  const plannedDays = new Map<string, Set<string>>();
  for (const b of live) {
    const day = dayKey(b.startsAt, timeZone);
    const week = startOfWeek(day, weekStartsOn);
    plannedDays.set(week, (plannedDays.get(week) ?? new Set()).add(day));
  }
  award("full_week", [...plannedDays.values()].some((set) => set.size === 7));

  const weekTotals = countBy(live, (b) => startOfWeek(dayKey(b.startsAt, timeZone), weekStartsOn));
  const weekDone = countBy(done, (b) => startOfWeek(dayKey(b.startsAt, timeZone), weekStartsOn));
  award("perfect_week", [...weekTotals].some(([week, total]) => total >= 5 && weekDone.get(week) === total));

  // A month only counts once it's over (so future blocks can't spoil it, and
  // an unfinished month can't earn it early).
  const thisMonth = dayKey(ctx.now, timeZone).slice(0, 7);
  const monthTotals = countBy(live, (b) => dayKey(b.startsAt, timeZone).slice(0, 7));
  const monthDone = countBy(done, (b) => dayKey(b.startsAt, timeZone).slice(0, 7));
  award(
    "perfect_month",
    [...monthTotals].some(([month, total]) => month < thisMonth && total >= 20 && monthDone.get(month) === total),
  );

  // Friends
  award("study_buddy", ctx.hasAcceptedHangout);
  award("social_butterfly", ctx.friendsCount >= 3);
  award("squad", ctx.friendsCount >= 10);
  return earned;
}
