"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  createTaskAction,
  deleteBlockAction,
  leaderboardAction,
  loadBlocksAction,
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
import { placeMany, type SkippedDay } from "./placement";
import { useProfile } from "@/lib/auth/profile";
import { levelOf, xpForCompletion } from "./levels";
import { loadLocal, localSaveKey, saveLocal } from "./local-save";
import type { FriendRequest, HangoutInvite, Interval, LeaderRow, PersonSummary, PlannedBlock, Suggestion } from "./types";

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
  flameStyle: string;
  title: string;
  leaderboard: LeaderRow[];
  /** Missed blocks found when the app loaded (shown once as a message). */
  missed: { count: number; xpLost: number } | null;
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
  flameStyle: "classic",
  title: "rookie",
  leaderboard: [],
  missed: null,
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
  /** One task on one or more days. Days that don't fit come back in `skipped`. */
  addTask: (input: NewTaskInput) => Promise<Result<{ blocks: PlannedBlock[]; skipped: SkippedDay[] }>>;
  /** Delete one occurrence (deleteTask removes the whole series). */
  deleteBlock: (blockId: string) => Promise<Result>;
  /** Replace all blocks with fresh ones from the server (after the Schedule Helper edits). */
  replaceBlocks: (blocks: PlannedBlock[]) => void;
  /** Reload the schedule from the database. */
  syncBlocks: () => Promise<PlannedBlock[] | null>;
  /** Finish (or un-finish) a block. Returns the XP it earned. */
  setDone: (blockId: string, done: boolean) => Promise<Result<{ xp: number }>>;
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
  /** pointsTotal is your XP. */
  flameStyle: string;
  title: string;
  equip: (kind: "flame" | "title", id: string) => Promise<Result>;
  leaderboard: LeaderRow[];
  refreshLeaderboard: (weekStart: number) => Promise<void>;
  missed: { count: number; xpLost: number } | null;
  /** Set when you just went up a level (shown by <LevelUp />), then cleared. */
  levelUp: { from: number; to: number } | null;
  dismissLevelUp: () => void;
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
  } catch (error) {
    console.error("[planner] request failed:", error);
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
  const [flameStyle, setFlameStyle] = useState(initial.flameStyle);
  const [title, setTitle] = useState(initial.title);
  const [leaderboard, setLeaderboard] = useState(initial.leaderboard);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);

  // Demo mode (no database): save each local account's schedule in this
  // browser under its own key, and load it back on the next visit.
  const localProfile = useProfile();
  const storageKey = mode === "local" ? localSaveKey(localProfile?.email) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    const saved = loadLocal(storageKey);
    setBlocks(saved?.blocks ?? initial.blocks);
    setPoints(saved?.pointsTotal ?? initial.pointsTotal);
    setFlameStyle(saved?.flameStyle ?? initial.flameStyle);
    setTitle(saved?.title ?? initial.title);
    setWeekStart(saved?.weekStartsOn ?? initial.weekStartsOn);
    setLoadedKey(storageKey);
    // Load once per account (not every time `initial` is re-created).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    // Only save once this account's data has been loaded (never overwrite it with an empty start).
    if (!storageKey || loadedKey !== storageKey) return;
    saveLocal(storageKey, { v: 1, blocks, pointsTotal, flameStyle, title, weekStartsOn });
  }, [storageKey, loadedKey, blocks, pointsTotal, flameStyle, title, weekStartsOn]);

  /** Change the XP total, celebrating if that crosses into a new level. */
  const applyXp = useCallback((next: number | ((prev: number) => number)) => {
    setPoints((prev) => {
      const value = Math.max(0, typeof next === "function" ? next(prev) : next);
      const [from, to] = [levelOf(prev), levelOf(value)];
      if (to > from) setLevelUp({ from, to });
      return value;
    });
  }, []);

  const equip = useCallback(
    async (kind: "flame" | "title", id: string): Promise<Result> => {
      const before = kind === "flame" ? flameStyle : title;
      (kind === "flame" ? setFlameStyle : setTitle)(id);
      if (mode === "local") return { ok: true };
      const result = await safely(() => saveSettingsAction(kind === "flame" ? { flameStyle: id } : { title: id }));
      if (!result.ok) (kind === "flame" ? setFlameStyle : setTitle)(before);
      return result;
    },
    [mode, flameStyle, title],
  );

  const refreshLeaderboard = useCallback(
    async (weekStart: number) => {
      if (mode !== "remote") return;
      const result = await safely(() => leaderboardAction(weekStart));
      if (result.ok) setLeaderboard(result.rows);
    },
    [mode],
  );

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

  /**
   * Re-load the schedule from the database, so the screen always matches
   * what's actually saved (after adding, after the Schedule Helper, and when
   * you come back to the app).
   */
  const syncBlocks = useCallback(async (): Promise<PlannedBlock[] | null> => {
    if (mode !== "remote") return null;
    const result = await safely(() => loadBlocksAction());
    if (!result.ok) return null;
    setBlocks([...result.blocks].sort((a, b) => a.startsAt - b.startsAt));
    applyXp(result.xp);
    return result.blocks;
  }, [mode, applyXp]);

  // Coming back to the tab/app: refresh (at most every 15 seconds).
  useEffect(() => {
    if (mode !== "remote") return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 15_000) return;
      last = Date.now();
      void syncBlocks();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [mode, syncBlocks]);

  const addTask = useCallback(
    async (input: NewTaskInput): Promise<Result<{ blocks: PlannedBlock[]; skipped: SkippedDay[] }>> => {
      const add = (added: PlannedBlock[]) =>
        setBlocks((prev) => {
          const known = new Set(prev.map((b) => b.id));
          return [...prev, ...added.filter((b) => !known.has(b.id))].sort((a, b) => a.startsAt - b.startsAt);
        });
      if (mode === "remote") {
        const result = await safely(() => createTaskAction(input));
        if (!result.ok) return result;
        add(result.blocks); // show it right away…
        const saved = await syncBlocks(); // …then confirm against the database.
        if (saved && !result.blocks.every((b) => saved.some((s) => s.id === b.id))) {
          console.error("[planner] the new task wasn't found after saving", result.blocks);
          add(result.blocks);
        }
        return result;
      }
      // Demo mode: the same placement rules, run in the browser.
      const title = input.title.trim();
      if (!title) return { ok: false, error: "Give your task a name" };
      const days = [...input.dayKeys].sort();
      const range = { start: dayRange(days[0], timeZone).start, end: dayRange(days.at(-1)!, timeZone).end };
      const busy = blocks
        .filter((b) => b.startsAt < range.end && b.endsAt > range.start && b.status !== "skipped")
        .map((b) => ({ start: b.startsAt, end: b.endsAt }));
      const { placed, skipped } = placeMany({ ...input, dayKeys: days, timeZone, now: Date.now(), busy });
      if (placed.length === 0) return { ok: false, error: skipped[0]?.error ?? "No open time on those days." };
      const taskId = crypto.randomUUID();
      const added: PlannedBlock[] = placed.map((p) => ({
        id: crypto.randomUUID(),
        taskId,
        title,
        color: input.color,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        status: "planned",
        completedAt: null,
      }));
      add(added);
      return { ok: true, blocks: added, skipped };
    },
    [mode, blocks, timeZone, syncBlocks],
  );

  const deleteBlock = useCallback(
    async (blockId: string): Promise<Result> => {
      const removed = blocks.filter((b) => b.id === blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (mode === "local") return { ok: true };
      const result = await safely(() => deleteBlockAction(blockId));
      if (!result.ok) setBlocks((prev) => [...prev, ...removed].sort((a, b) => a.startsAt - b.startsAt));
      return result;
    },
    [mode, blocks],
  );

  const replaceBlocks = useCallback((next: PlannedBlock[]) => setBlocks([...next].sort((a, b) => a.startsAt - b.startsAt)), []);

  const setDone = useCallback(
    async (blockId: string, done: boolean): Promise<Result<{ xp: number }>> => {
      const before = blocks.find((b) => b.id === blockId);
      if (!before || (before.status === "done") === done) return { ok: true, xp: 0 };
      const now = Date.now();
      // Optimistic: update the screen right away with the XP we expect…
      const patch = (status: PlannedBlock["status"], completedAt: number | null) =>
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, status, completedAt } : b)));
      const expected = done ? xpForCompletion(blocks, now, timeZone) : 0;
      patch(done ? "done" : "planned", done ? now : null);
      if (done) {
        applyXp((p) => p + expected);
        fireConfetti();
      }

      if (mode === "local") {
        if (!done) applyXp((p) => p - (before.completedAt ? xpForCompletion(blocks.filter((b) => b.id !== blockId), before.completedAt, timeZone) : 0));
        return { ok: true, xp: expected };
      }
      const result = await safely(() => setBlockDoneAction(blockId, done));
      if (!result.ok) {
        // Roll back.
        patch(before.status, before.completedAt);
        if (done) applyXp((p) => p - expected);
        return result;
      }
      // …then use the server's exact total (it decides the XP).
      applyXp(result.total);
      return { ok: true, xp: result.xp };
    },
    [mode, blocks, timeZone, applyXp],
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
      deleteBlock,
      replaceBlocks,
      syncBlocks,
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
      flameStyle,
      title,
      equip,
      leaderboard,
      refreshLeaderboard,
      missed: initial.missed,
      levelUp,
      dismissLevelUp: () => setLevelUp(null),
    }),
    [
      mode, timeZone, weekStartsOn, profile, blocks, pointsTotal, friends, requests, suggestions, initial.inviteCode,
      hangouts, hasAcceptedHangout, addTask, deleteBlock, replaceBlocks, syncBlocks, setDone, deleteTask, setWeekStartsOn, respondRequest, requestFriend,
      friendBusy, sendHangout, respondHangout, prefs, setPrefs, flameStyle, title, equip, leaderboard,
      refreshLeaderboard, initial.missed, levelUp,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}
