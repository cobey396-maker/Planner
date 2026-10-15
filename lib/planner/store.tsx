"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { fireConfetti } from "@/lib/confetti";
import type { TaskColor } from "@/lib/design/tokens";
import { firstFit } from "./free-time";
import { MOCK_FRIENDS, MOCK_REQUESTS, mockBlocks } from "./mock";
import type { Block, Friend, FriendRequest } from "./types";

/**
 * CLIENT-SIDE PLANNER STATE
 *
 * One React context holds the week's blocks, what's been completed, and the
 * friends list. It lives in app/(tabs)/layout.tsx, which stays mounted while
 * you switch tabs, so checking something off on Today shows up on Week and
 * Streaks immediately.
 *
 * This is in-memory sample data for now. In Phase 2+ these functions call the
 * database (server actions), and the screens don't need to change much: they
 * only ever talk to this API.
 */

/** The planner only places tasks between these times. */
export const DAY_START = 7 * 60;
export const DAY_END = 23 * 60;

export type NewTask = { title: string; minutes: number; color: TaskColor; day: number };

type PlannerValue = {
  blocks: Block[];
  completed: ReadonlySet<string>;
  friends: Friend[];
  requests: FriendRequest[];
  toggleComplete: (id: string) => void;
  removeBlock: (id: string) => void;
  /** Places the task in the first free gap; returns the new block or null. */
  addTask: (task: NewTask, notBefore?: number) => Block | null;
  acceptRequest: (id: string) => void;
  declineRequest: (id: string) => void;
};

const PlannerContext = createContext<PlannerValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<Block[]>(mockBlocks);
  const [completed, setCompleted] = useState<ReadonlySet<string>>(() => new Set());
  const [friends, setFriends] = useState<Friend[]>(MOCK_FRIENDS);
  const [requests, setRequests] = useState<FriendRequest[]>(MOCK_REQUESTS);

  const toggleComplete = useCallback(
    (id: string) => {
      // Celebrate only on the not-done → done transition, never on un-checking.
      // This lives OUTSIDE the setState updater below: React may run updaters
      // twice in development (Strict Mode), and side effects in them would too.
      if (!completed.has(id)) fireConfetti();
      setCompleted((prev) => {
        // Never mutate state: copy the Set, change the copy, return it.
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [completed],
  );

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addTask = useCallback(
    (task: NewTask, notBefore?: number): Block | null => {
      const busy = blocks.filter((b) => b.day === task.day);
      const slot = firstFit(busy, task.minutes, DAY_START, DAY_END, notBefore);
      if (!slot) return null;
      const block: Block = {
        id: `t${Date.now()}`,
        title: task.title,
        color: task.color,
        kind: "task",
        day: task.day,
        ...slot,
      };
      setBlocks((prev) => [...prev, block]);
      return block;
    },
    [blocks],
  );

  const acceptRequest = useCallback(
    (id: string) => {
      const req = requests.find((r) => r.id === id);
      if (!req) return;
      setRequests((prev) => prev.filter((r) => r.id !== id));
      // A new friend's calendar isn't shared yet in the mock, so: always free.
      setFriends((prev) => [...prev, { ...req, busy: Array.from({ length: 7 }, () => []) }]);
    },
    [requests],
  );

  const declineRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      blocks,
      completed,
      friends,
      requests,
      toggleComplete,
      removeBlock,
      addTask,
      acceptRequest,
      declineRequest,
    }),
    [blocks, completed, friends, requests, toggleComplete, removeBlock, addTask, acceptRequest, declineRequest],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside <PlannerProvider>");
  return ctx;
}

/** Blocks of one day, earliest first. */
export function blocksForDay(blocks: Block[], day: number): Block[] {
  return blocks.filter((b) => b.day === day).sort((a, b) => a.start - b.start);
}
