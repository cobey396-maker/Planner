import { addDays, isoWeekday } from "@/lib/tz";
import { MAX_OCCURRENCES } from "./placement";

/**
 * REPEATING TASKS: "gym at 5 every Monday, Thursday and Friday".
 *
 * A repeating task is stored as ONE task with one block per occurrence, so
 * each occurrence can be finished, moved or deleted on its own, and streaks
 * and badges just work. This file turns a rule into the list of days.
 *
 * Weekdays are ISO numbers: 1 = Monday … 7 = Sunday.
 */
export type RepeatRule =
  | { kind: "daily" }
  | { kind: "weekdays" } // Monday to Friday
  | { kind: "weekly"; weekdays: number[] }; // e.g. [1, 4, 5]

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function matches(rule: RepeatRule, day: string): boolean {
  const wd = isoWeekday(day);
  if (rule.kind === "daily") return true;
  if (rule.kind === "weekdays") return wd <= 5;
  return rule.weekdays.includes(wd);
}

/** Every matching day from `from` to `until` (both included), capped at MAX_OCCURRENCES. */
export function expandRepeat(rule: RepeatRule, from: string, until: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= until && days.length < MAX_OCCURRENCES; day = addDays(day, 1)) {
    if (matches(rule, day)) days.push(day);
  }
  return days;
}

/** "every day", "every weekday", "every Mon, Thu & Fri", "every Wednesday". */
export function describeRepeat(rule: RepeatRule): string {
  if (rule.kind === "daily") return "every day";
  if (rule.kind === "weekdays") return "every weekday";
  const days = [...new Set(rule.weekdays)].sort();
  if (days.length === 7) return "every day";
  if (days.length === 1) {
    const full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return `every ${full[days[0] - 1]}`;
  }
  const names = days.map((d) => WEEKDAY_NAMES[d - 1]);
  return `every ${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
