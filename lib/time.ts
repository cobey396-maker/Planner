/**
 * Time helpers. The schedule stores times as "minutes since midnight" in the
 * user's own time zone (9:30 AM = 570). Small integers are easy to compare,
 * sort and do math on, which is exactly what a scheduler needs. Converting to
 * real Date objects (and handling time zones properly) arrives with the
 * database in Phase 2 and the Today/Week work in Phase 4.
 */

export const MINUTES_PER_DAY = 24 * 60;

/**
 * Creating an Intl.DateTimeFormat is slow (it loads locale data); using one
 * is fast. Screens format hundreds of times per render (every time option in
 * the add-task sheet, every block on Week), and building a new formatter each
 * time was the biggest JavaScript cost of switching tabs. So build each
 * distinct formatter once and reuse it.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, f);
  }
  return f;
}

/** 570 → "9:30 AM" in the user's locale (24-hour clocks get "09:30"). */
export function formatClock(minutes: number, locale?: string): string {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return formatter(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** 540, 615 → "9:00 – 10:15 AM" (the shared AM/PM is only shown once). */
export function formatRange(start: number, end: number, locale?: string): string {
  const fmt = formatter(locale, { hour: "numeric", minute: "2-digit" });
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

/** "6:00 PM" for an instant, shown in the given time zone. */
export function formatTime(ms: number, timeZone: string): string {
  return formatter(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).format(ms);
}

/** "6:00 – 7:30 PM" for two instants in the given time zone. */
export function formatTimeRange(start: number, end: number, timeZone: string): string {
  return formatter(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).formatRange(start, end);
}

/** A day key ("2026-10-14") as words, e.g. { weekday: "long", month: "long", day: "numeric" }. */
export function formatDayKey(key: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = key.split("-").map(Number);
  // Noon UTC of that date, formatted in UTC: always the right calendar day.
  return formatter(undefined, { ...options, timeZone: "UTC" }).format(Date.UTC(y, m - 1, d, 12));
}
