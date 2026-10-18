"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  createTaskAction,
  deleteTaskAction,
  friendBusyAction,
  requestFriendAction,
  respondFriendAction,
  respondHangoutAction,
  sendHangoutAction,
  setBlockDoneAction,
  type NewTaskInput,
} from "@/app/actions/planner";
import { saveSettingsAction } from "@/app/actions/profile";
import { fireConfetti } from "@/lib/confetti";
import { dayRange } from "@/lib/tz";
import { placeTask } from "./placement";
import { POINTS_PER_BLOCK } from "./stats";
import type { FriendRequest, HangoutInvite, Interval, PersonSummary, PlannedBlock, Suggestion } from "./types";

/**
 * PLANNER STATE (client)
 *
 * Every account starts empty: no tasks, no points, no friends. The server
 * loads the user's real data (lib/planner/load.ts) and hands it in as
 * `initial`. Changes update the screen immediately ("optimistic UI") and are
 * saved by server actions; if saving fails, the change is rolled back.
 *
 * mode "local" = demo mode (no account): the same features, kept in memory
 * in this browser tab only.
 */

export type Mode = "remote" | "local";

export type InitialPlannerData = {
  timeZone: string | null;
  weekStartsOn: 1 | 7;
  profile: PersonSummary | null;
  blocks: PlannedBlock[];
  pointsTotal: number;
  friends: PersonSummary[];
  requests: FriendRequest[];
  suggestions: Suggestion[];
  inviteCode: string | null;
  hangouts: HangoutInvite[];
  hasAcceptedHangout: boolean;
  /** Notification and privacy preferences (null in demo mode). */
  prefs: Prefs | null;
};

export type Prefs = {
  notifyUpcoming: boolean;
  notifyMissed: boolean;
  notifyFriends: boolean;
  reminderLeadMinutes: number;
  discoverable: boolean;
};

export const EMPTY_PLANNER: InitialPlannerData = {
  timeZone: null,
  weekStartsOn: 1,
  profile: null,
  blocks: [],
  pointsTotal: 0,
  friends: [],
  requests: [],
  suggestions: [],
  inviteCode: null,
  hangouts: [],
  hasAcceptedHangout: false,
  prefs: null,
};

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

type PlannerValue = {
  mode: Mode;
  /** The user's time zone (their saved one, or this device's in demo mode). */
  timeZone: string;
  weekStartsOn: 1 | 7;
  profile: PersonSummary | null;
  blocks: PlannedBlock[];
  pointsTotal: number;
  friends: PersonSummary[];
  requests: FriendRequest[];
  suggestions: Suggestion[];
  inviteCode: string | null;
  hangouts: HangoutInvite[];
  hasAcceptedHangout: boolean;
  addTask: (input: NewTaskInput) => Promise<Result<{ block: PlannedBlock }>>;
  setDone: (blockId: string, done: boolean) => Promise<Result>;
  deleteTask: (taskId: string) => Promise<Result>;
  setWeekStartsOn: (value: 1 | 7) => Promise<void>;
  respondRequest: (friendshipId: string, accept: boolean) => Promise<Result>;
  requestFriend: (personId: string) => Promise<Result>;
  friendBusy: (friendId: string, dayKey: string) => Promise<Result<{ busy: Interval[]; mine: Interval[] }>>;
  sendHangout: (friendId: string, startsAt: number, endsAt: number, activity: string) => Promise<Result>;
  respondHangout: (inviteId: string, accept: boolean) => Promise<Result>;
  setProfile: (profile: PersonSummary) => void;
  prefs: Prefs | null;
  setPrefs: (patch: Partial<Prefs>) => Promise<Result>;
};

const PlannerContext = createContext<PlannerValue | null>(null);

/** This device's time zone; unknown (null) during server rendering. */
function useDeviceTimeZone(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

const offline = { ok: false as const, error: "Couldn't reach the server. Check your connection and try again." };
async function safely<T>(fn: () => Promise<T>): Promise<T | typeof offline> {
  try {
    return await fn();
  } catch {
    return offline;
  }
}

export function PlannerProvider({ initial, mode, children }: { initial: InitialPlannerData; mode: Mode; children: ReactNode }) {
  const device = useDeviceTimeZone();
  const timeZone = initial.timeZone ?? device ?? "UTC";
  const [weekStartsOn, setWeekStart] = useState<1 | 7>(initial.weekStartsOn);
  const [profile, setProfile] = useState(initial.profile);
  const [blocks, setBlocks] = useState(initial.blocks);
  const [pointsTotal, setPoints] = useState(initial.pointsTotal);
  const [friends, setFriends] = useState(initial.friends);
  const [requests, setRequests] = useState(initial.requests);
  const [suggestions, setSuggestions] = useState(initial.suggestions);
  const [hangouts, setHangouts] = useState(initial.hangouts);
  const [hasAcceptedHangout, setHasAcceptedHangout] = useState(initial.hasAcceptedHangout);
  const [prefs, setPrefsState] = useState(initial.prefs);

  const setPrefs = useCallback(
    async (patch: Partial<Prefs>): Promise<Result> => {
      const before = prefs;
      setPrefsState((p) => (p ? { ...p, ...patch } : p));
      if (mode === "local") return { ok: true };
      const result = await safely(() => saveSettingsAction(patch as Parameters<typeof saveSettingsAction>[0]));
      if (!result.ok) setPrefsState(before);
      return result;
    },
    [mode, prefs],
  );

  const addTask = useCallback(
    async (input: NewTaskInput): Promise<Result<{ block: PlannedBlock }>> => {
      if (mode === "remote") {
        const result = await safely(() => createTaskAction(input));
        if (result.ok) setBlocks((prev) => [...prev, result.block].sort((a, b) => a.startsAt - b.startsAt));
        return result;
      }
      // Demo mode: the same placement rules, run in the browser.
      const title = input.title.trim();
      if (!title) return { ok: false, error: "Give your task a name" };
      const range = dayRange(input.dayKey, timeZone);
      const busy = blocks
        .filter((b) => b.startsAt < range.end && b.endsAt > range.start && b.status !== "skipped")
        .map((b) => ({ start: b.startsAt, end: b.endsAt }));
      const slot = placeTask({ ...input, timeZone, now: Date.now(), busy });
      if (!slot.ok) return slot;
      const block: PlannedBlock = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        title,
        color: input.color,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: "planned",
        completedAt: null,
      };
      setBlocks((prev) => [...prev, block].sort((a, b) => a.startsAt - b.startsAt));
      return { ok: true, block };
    },
    [mode, blocks, timeZone],
  );

  const setDone = useCallback(
    async (blockId: string, done: boolean): Promise<Result> => {
      const before = blocks.find((b) => b.id === blockId);
      if (!before || (before.status === "done") === done) return { ok: true };
      // Optimistic: update the screen right away.
      const patch = (status: PlannedBlock["status"], completedAt: number | null) =>
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, status, completedAt } : b)));
      patch(done ? "done" : "planned", done ? Date.now() : null);
      setPoints((p) => Math.max(0, p + (done ? POINTS_PER_BLOCK : -POINTS_PER_BLOCK)));
      if (done) fireConfetti();

      if (mode === "local") return { ok: true };
      const result = await safely(() => setBlockDoneAction(blockId, done));
      if (!result.ok) {
        // Roll back.
        patch(before.status, before.completedAt);
        setPoints((p) => Math.max(0, p + (done ? -POINTS_PER_BLOCK : POINTS_PER_BLOCK)));
        return result;
      }
      return { ok: true };
    },
    [mode, blocks],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<Result> => {
      const removed = blocks.filter((b) => b.taskId === taskId);
      setBlocks((prev) => prev.filter((b) => b.taskId !== taskId));
      if (mode === "local") return { ok: true };
      const result = await safely(() => deleteTaskAction(taskId));
      if (!result.ok) setBlocks((prev) => [...prev, ...removed].sort((a, b) => a.startsAt - b.startsAt));
      return result;
    },
    [mode, blocks],
  );

  const setWeekStartsOn = useCallback(
    async (value: 1 | 7) => {
      setWeekStart(value);
      if (mode === "remote") await safely(() => saveSettingsAction({ weekStartsOn: value }));
    },
    [mode],
  );

  const respondRequest = useCallback(
    async (friendshipId: string, accept: boolean): Promise<Result> => {
      const request = requests.find((r) => r.friendshipId === friendshipId);
      if (!request) return { ok: true };
      setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
      if (accept) setFriends((prev) => [...prev, request.from]);
      const result = mode === "remote" ? await safely(() => respondFriendAction(friendshipId, accept)) : { ok: true as const };
      if (!result.ok) {
        setRequests((prev) => [...prev, request]);
        if (accept) setFriends((prev) => prev.filter((f) => f.id !== request.from.id));
      }
      return result;
    },
    [mode, requests],
  );

  const requestFriend = useCallback(
    async (personId: string): Promise<Result> => {
      if (mode === "local") return { ok: false, error: "Create an account to add friends." };
      const result = await safely(() => requestFriendAction(personId));
      if (result.ok) setSuggestions((prev) => prev.filter((s) => s.id !== personId));
      return result;
    },
    [mode],
  );

  const friendBusy = useCallback(
    async (friendId: string, dayKey: string) => {
      if (mode === "local") return { ok: false as const, error: "Create an account to compare schedules." };
      return safely(() => friendBusyAction(friendId, dayKey));
    },
    [mode],
  );

  const sendHangout = useCallback(
    async (friendId: string, startsAt: number, endsAt: number, activity: string) => {
      if (mode === "local") return { ok: false as const, error: "Create an account to send invites." };
      return safely(() => sendHangoutAction({ friendId, startsAt, endsAt, activity }));
    },
    [mode],
  );

  const respondHangout = useCallback(
    async (inviteId: string, accept: boolean): Promise<Result> => {
      const invite = hangouts.find((h) => h.id === inviteId);
      setHangouts((prev) => prev.filter((h) => h.id !== inviteId));
      const result = mode === "remote" ? await safely(() => respondHangoutAction(inviteId, accept)) : { ok: true as const };
      if (!result.ok && invite) setHangouts((prev) => [...prev, invite]);
      if (result.ok && accept) setHasAcceptedHangout(true);
      return result;
    },
    [mode, hangouts],
  );

  const value = useMemo<PlannerValue>(
    () => ({
      mode,
      timeZone,
      weekStartsOn,
      profile,
      blocks,
      pointsTotal,
      friends,
      requests,
      suggestions,
      inviteCode: initial.inviteCode,
      hangouts,
      hasAcceptedHangout,
      addTask,
      setDone,
      deleteTask,
      setWeekStartsOn,
      respondRequest,
      requestFriend,
      friendBusy,
      sendHangout,
      respondHangout,
      setProfile,
      prefs,
      setPrefs,
    }),
    [
      mode, timeZone, weekStartsOn, profile, blocks, pointsTotal, friends, requests, suggestions, initial.inviteCode,
      hangouts, hasAcceptedHangout, addTask, setDone, deleteTask, setWeekStartsOn, respondRequest, requestFriend,
      friendBusy, sendHangout, respondHangout, prefs, setPrefs,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}
