/**
 * TIME ZONE MATH, without a library.
 *
 * The database stores exact instants (UTC). People think in local calendar
 * days ("Tuesday") and wall-clock times ("6 PM") in THEIR time zone, which
 * may differ from the computer's (traveling, or the server, which runs in
 * UTC). Every date on Today/Week/Streaks goes through these helpers.
 *
 * A "day key" is the local date as "YYYY-MM-DD". Day keys sort correctly as
 * strings and are easy to use as map keys.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * Asking Intl for the parts of a date is slow (it was most of the time spent
 * opening the Streaks tab with a year of blocks). But a zone's offset from
 * UTC only changes at daylight-saving switches: a couple of times a year, and
 * always on a 15-minute boundary. So we cache the offset:
 *   - per UTC day, when the offset is the same at both ends of the day
 *     (every day but the switch days): 2 Intl calls cover the whole day;
 *   - per 15-minute window on the rare day that contains a switch.
 * Everything else is plain UTC date math.
 * tests/unit/tz.test.ts checks this against Intl across zones and switches.
 */
const DAY = 86_400_000;
const BUCKET = 15 * 60_000;
/** Offset for a whole UTC day, or null if that day contains a switch. */
const dayOffsets = new Map<string, number | null>();
const offsets = new Map<string, number>();

function slowOffsetMinutes(instant: number, timeZone: string): number {
  const p = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(instant)
      .map((x) => [x.type, Number(x.value)]),
  );
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asIfUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

/** How far the zone is ahead of UTC at that instant, in minutes (Chicago in summer: -300). */
export function offsetMinutes(instant: number, timeZone: string): number {
  const day = Math.floor(instant / DAY);
  const dayKeyStr = `${timeZone}|${day}`;
  let whole = dayOffsets.get(dayKeyStr);
  if (whole === undefined) {
    if (dayOffsets.size > 20_000) dayOffsets.clear();
    const a = slowOffsetMinutes(day * DAY, timeZone);
    const b = slowOffsetMinutes((day + 1) * DAY - BUCKET, timeZone);
    whole = a === b ? a : null;
    dayOffsets.set(dayKeyStr, whole);
  }
  if (whole !== null) return whole;

  const bucket = Math.floor(instant / BUCKET);
  const key = `${timeZone}|${bucket}`;
  let off = offsets.get(key);
  if (off === undefined) {
    if (offsets.size > 20_000) offsets.clear(); // ~200 days of windows per zone; plenty.
    off = slowOffsetMinutes(bucket * BUCKET, timeZone);
    offsets.set(key, off);
  }
  return off;
}

/** The wall-clock fields of an instant in a time zone. */
export function zonedParts(instant: number, timeZone: string) {
  const d = new Date(instant + offsetMinutes(instant, timeZone) * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-14" for an instant, in the given zone. */
export function dayKey(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight (0–1439) for an instant, in the given zone. */
export function minuteOfDay(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

function keyToUtcMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Calendar arithmetic on day keys (no time zone involved). */
export function addDays(key: string, days: number): string {
  const d = new Date(keyToUtcMidnight(key) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ISO weekday of a day key: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  const dow = new Date(keyToUtcMidnight(key)).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 7 : dow;
}

/** The first day of the week containing `key`, for weeks starting Monday (1) or Sunday (7). */
export function startOfWeek(key: string, weekStartsOn: 1 | 7 = 1): string {
  const back = (isoWeekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -back);
}

/**
 * The exact instant of a local wall-clock time: "6 PM on 2026-11-02 in
 * Chicago" → epoch ms. Algorithm: pretend the wall time is UTC, subtract the
 * zone's offset, then re-check the offset at the result (it can differ when
 * the guess lands across a daylight-saving change) and correct once.
 * Times that don't exist (2:30 AM on spring-forward day) roll forward.
 */
export function zonedTimeToUtc(key: string, minute: number, timeZone: string): number {
  const wall = keyToUtcMidnight(key) + minute * 60_000;
  const first = wall - offsetMinutes(wall, timeZone) * 60_000;
  const second = wall - offsetMinutes(first, timeZone) * 60_000;
  return offsetMinutes(second, timeZone) === offsetMinutes(first, timeZone) ? second : Math.max(first, second);
}

/** [start, end) instants of a local day. Usually 24h; 23h or 25h on DST days. */
export function dayRange(key: string, timeZone: string): { start: number; end: number } {
  return { start: zonedTimeToUtc(key, 0, timeZone), end: zonedTimeToUtc(addDays(key, 1), 0, timeZone) };
}
