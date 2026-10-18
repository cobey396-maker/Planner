/**
 * Time helpers. The schedule stores times as "minutes since midnight" in the
 * user's own time zone (9:30 AM = 570). Small integers are easy to compare,
 * sort and do math on, which is exactly what a scheduler needs. Converting to
 * real Date objects (and handling time zones properly) arrives with the
 * database in Phase 2 and the Today/Week work in Phase 4.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** 570 → "9:30 AM" in the user's locale (24-hour clocks get "09:30"). */
export function formatClock(minutes: number, locale?: string): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** 540, 615 → "9:00 – 10:15 AM" (the shared AM/PM is only shown once). */
export function formatRange(start: number, end: number, locale?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const a = new Date(2000, 0, 1, Math.floor(start / 60), start % 60);
  const b = new Date(2000, 0, 1, Math.floor(end / 60), end % 60);
  return fmt.formatRange(a, b);
}

/** 75 → "1h 15m", 60 → "1h", 45 → "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Minutes since midnight for a Date. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Index of the weekday with Monday = 0 … Sunday = 6. JavaScript's getDay()
 * starts at Sunday = 0, which is awkward for a school/work week.
 */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The Monday (00:00) of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - mondayIndex(d));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Is this a real IANA time zone ("America/Chicago")? The JavaScript runtime
 * throws a RangeError for names it doesn't know. (The database double-checks
 * against Postgres's own list.)
 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
