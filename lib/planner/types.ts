import type { TaskColor } from "@/lib/design/tokens";

/** A span of time within one day, in minutes since midnight. [start, end) */
export type Interval = { start: number; end: number };

/**
 * One block on the schedule. `day` is 0–6 (Monday–Sunday of the current week).
 * In Phase 2 this becomes a database row with real timestamps; the shape of
 * the UI code stays the same.
 */
export type Block = Interval & {
  id: string;
  title: string;
  color: TaskColor;
  kind: "event" | "task";
  day: number;
};

export type Friend = {
  id: string;
  name: string;
  handle: string;
  color: TaskColor;
  /** When they're busy each day (Mon–Sun). We never see WHAT they're doing. */
  busy: Interval[][];
};

export type FriendRequest = { id: string; name: string; handle: string; color: TaskColor };
