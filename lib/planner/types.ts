import type { TaskColor } from "@/lib/design/tokens";

/** A span of time, in minutes (or ms, where noted). [start, end) */
export type Interval = { start: number; end: number };

export type BlockStatus = "planned" | "done" | "missed" | "skipped";

/**
 * One scheduled work session, as the screens use it. Times are exact
 * instants (epoch milliseconds); screens turn them into local days and
 * times with lib/tz.ts in the user's own time zone.
 */
export type PlannedBlock = {
  id: string;
  taskId: string;
  title: string;
  color: TaskColor;
  startsAt: number;
  endsAt: number;
  status: BlockStatus;
  completedAt: number | null;
};

/** What friends (and suggested people) can see of each other. */
export type PersonSummary = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarColor: TaskColor;
  city: string | null;
  region: string | null;
};

export type FriendRequest = { friendshipId: string; from: PersonSummary };
export type Suggestion = PersonSummary & { mutualCount: number; reason: "mutual" | "nearby" };
export type HangoutInvite = {
  id: string;
  from: PersonSummary;
  startsAt: number;
  endsAt: number;
  activity: string;
};

export type PlannerSettings = {
  timeZone: string;
  weekStartsOn: 1 | 7;
};
