import type { Block, Friend, FriendRequest, Interval } from "./types";

/**
 * SAMPLE DATA so every screen can be designed and tested before the database
 * exists (Phase 2). It describes a believable week for a high-school student
 * with a part-time job. Times are minutes since midnight: h(9, 30) = 570.
 */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

type Seed = Omit<Block, "id" | "day">;

const chem: Seed = { title: "AP Chem", color: "blue", kind: "event", start: h(9), end: h(10, 15) };
const calc: Seed = { title: "Calculus", color: "purple", kind: "event", start: h(10, 30), end: h(11, 45) };
const chemLab: Seed = { title: "Chem lab", color: "blue", kind: "event", start: h(9), end: h(11) };
const spanish: Seed = { title: "Spanish", color: "teal", kind: "event", start: h(12), end: h(13) };
const shift: Seed = { title: "Shift at Juice Bar", color: "green", kind: "event", start: h(15, 30), end: h(19, 30) };
const gym: Seed = { title: "Gym", color: "red", kind: "event", start: h(18), end: h(19) };
const task = (title: string, color: Block["color"], start: number, end: number): Seed => ({
  title,
  color,
  kind: "task",
  start,
  end,
});

const WEEK: Seed[][] = [
  // Monday
  [chem, calc, task("History essay · outline", "orange", h(16), h(17)), gym, task("Calc problem set", "purple", h(20), h(20, 45))],
  // Tuesday
  [chemLab, spanish, shift, task("Read Gatsby ch. 5", "indigo", h(20, 30), h(21, 15))],
  // Wednesday
  [chem, calc, task("History essay · draft", "orange", h(14), h(15, 30)), gym, task("Spanish vocab", "teal", h(20), h(20, 30))],
  // Thursday
  [chemLab, spanish, shift, task("Calc quiz review", "purple", h(20), h(21))],
  // Friday
  [chem, calc, task("History essay · final", "orange", h(13), h(14, 30)), gym, { title: "Movie night", color: "pink", kind: "event", start: h(20), end: h(22, 30) }],
  // Saturday
  [{ ...shift, start: h(10), end: h(15) }, { title: "Robotics club", color: "yellow", kind: "event", start: h(16), end: h(18) }, task("Laundry", "teal", h(19), h(19, 30))],
  // Sunday
  [task("Chem pre-lab", "blue", h(11), h(12)), task("Plan the week", "indigo", h(19), h(19, 20)), task("Spanish vocab", "teal", h(20), h(20, 30))],
];

export function mockBlocks(): Block[] {
  return WEEK.flatMap((day, dayIndex) =>
    day.map((seed, i) => ({ ...seed, id: `b${dayIndex}-${i}`, day: dayIndex })),
  );
}

/** Busy spans only: friends' event names are never part of this data. */
const busyWeek = (pattern: Interval[][]): Interval[][] => pattern;

export const MOCK_FRIENDS: Friend[] = [
  {
    id: "f1",
    name: "Maya Chen",
    handle: "maya",
    color: "pink",
    busy: busyWeek([
      [{ start: h(8), end: h(14) }, { start: h(17), end: h(18, 30) }],
      [{ start: h(8), end: h(15) }],
      [{ start: h(8), end: h(14) }, { start: h(19), end: h(21) }],
      [{ start: h(8), end: h(15) }, { start: h(16), end: h(17) }],
      [{ start: h(8), end: h(13) }],
      [{ start: h(11), end: h(13) }],
      [{ start: h(10), end: h(12) }],
    ]),
  },
  {
    id: "f2",
    name: "Jordan Lee",
    handle: "jordan",
    color: "green",
    busy: busyWeek([
      [{ start: h(8), end: h(15) }, { start: h(16), end: h(20) }],
      [{ start: h(8), end: h(15) }],
      [{ start: h(8), end: h(15) }, { start: h(16), end: h(20) }],
      [{ start: h(8), end: h(15) }],
      [{ start: h(8), end: h(15) }, { start: h(18), end: h(21) }],
      [{ start: h(9), end: h(17) }],
      [],
    ]),
  },
  {
    id: "f3",
    name: "Sam Rivera",
    handle: "samr",
    color: "orange",
    busy: busyWeek([
      [{ start: h(9), end: h(16) }],
      [{ start: h(9), end: h(12) }, { start: h(13), end: h(18) }],
      [{ start: h(9), end: h(16) }],
      [{ start: h(9), end: h(12) }, { start: h(13), end: h(18) }],
      [{ start: h(9), end: h(14) }],
      [{ start: h(12), end: h(20) }],
      [{ start: h(14), end: h(16) }],
    ]),
  },
  {
    id: "f4",
    name: "Priya Patel",
    handle: "priya",
    color: "indigo",
    busy: busyWeek([
      [{ start: h(8), end: h(15) }, { start: h(18), end: h(20) }],
      [{ start: h(8), end: h(15) }, { start: h(17), end: h(19) }],
      [{ start: h(8), end: h(15) }, { start: h(18), end: h(20) }],
      [{ start: h(8), end: h(15) }, { start: h(17), end: h(19) }],
      [{ start: h(8), end: h(15) }],
      [],
      [{ start: h(9), end: h(13) }],
    ]),
  },
];

export const MOCK_REQUESTS: FriendRequest[] = [
  { id: "r1", name: "Alex Kim", handle: "alexk", color: "teal" },
];

/** Past performance for the Streaks screen (until Phase 8 tracks it for real). */
export const MOCK_HISTORY = {
  streakDays: 12,
  bestStreak: 21,
  points: 1340,
  /** Share of planned blocks completed, last week Mon–Sun. */
  lastWeek: [1, 0.8, 0.9, 0.75, 1, 0.6, 0.7],
};
