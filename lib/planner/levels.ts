import { dayKey, minuteOfDay } from "@/lib/tz";
import { completionDays, currentStreak } from "./stats";
import type { PlannedBlock } from "./types";

/**
 * XP AND LEVELS (Fortnite-style).
 *
 * The SERVER is the source of truth: XP is written only by database
 * functions (migration 5). This file mirrors the same rules so screens can
 * show progress instantly, and demo mode can work without a server.
 * tests/unit/database-v5.test.ts checks that both agree.
 */

export const XP = {
  complete: 100,
  /** Finished before 9 AM, local time. */
  early: 50,
  earlyBeforeMinute: 9 * 60,
  /** Per streak day, paid on the first finish of the day from day 2 on. */
  streakPerDay: 20,
  streakMax: 200,
  /** A block ended without being done. Never drops you a level. */
  missed: -50,
  /** Only this many finished blocks per day earn XP. */
  dailyCap: 10,
} as const;

export const MAX_LEVEL = 200;

/** Total XP needed to reach level n. L1→L2 costs 500, +50 per level, flat 1,500 from L21→22 on. */
export function levelStart(n: number): number {
  if (n <= 1) return 0;
  if (n <= 22) return 450 * (n - 1) + 25 * (n - 1) * n;
  return 21000 + 1500 * (n - 22);
}

export function levelOf(xp: number): number {
  let n = 1;
  while (n < MAX_LEVEL && levelStart(n + 1) <= xp) n++;
  return n;
}

/** Where you are inside your current level, for the progress bar. */
export function levelProgress(xp: number) {
  const level = levelOf(xp);
  const start = levelStart(level);
  const next = level >= MAX_LEVEL ? start : levelStart(level + 1);
  const into = xp - start;
  const needed = next - start;
  return { level, into, needed, fraction: needed ? into / needed : 1, toNext: Math.max(0, next - xp) };
}

/** The streak bonus for a first finish of the day on a `streak`-day streak. */
export function streakBonus(streak: number): number {
  return streak >= 2 ? Math.min(XP.streakPerDay * streak, XP.streakMax) : 0;
}

export type FlameStyle = "classic" | "blue" | "green" | "purple" | "gold" | "rainbow";
export type TitleId = "rookie" | "planner" | "on_track" | "grinder" | "time_lord" | "legend" | "mythic";

export type Reward =
  | { id: FlameStyle; kind: "flame"; level: number; streak?: number; name: string; emoji: string }
  | { id: TitleId; kind: "title"; level: number; name: string; emoji: string };

/** The reward track (same ids and levels as the `rewards` table). */
export const REWARDS: Reward[] = [
  { id: "classic", kind: "flame", level: 1, name: "Classic flame", emoji: "🔥" },
  { id: "rookie", kind: "title", level: 1, name: "Rookie", emoji: "🐣" },
  { id: "planner", kind: "title", level: 3, name: "Planner", emoji: "🗒️" },
  { id: "blue", kind: "flame", level: 5, name: "Blue flame", emoji: "💙" },
  { id: "on_track", kind: "title", level: 8, name: "On Track", emoji: "🛤️" },
  { id: "green", kind: "flame", level: 10, name: "Green flame", emoji: "💚" },
  { id: "grinder", kind: "title", level: 12, name: "Grinder", emoji: "⚙️" },
  { id: "purple", kind: "flame", level: 15, streak: 10, name: "Purple flame", emoji: "💜" },
  { id: "time_lord", kind: "title", level: 20, name: "Time Lord", emoji: "⏳" },
  { id: "gold", kind: "flame", level: 25, name: "Gold flame", emoji: "💛" },
  { id: "legend", kind: "title", level: 35, name: "Legend", emoji: "🏆" },
  { id: "rainbow", kind: "flame", level: 50, name: "Rainbow flame", emoji: "🌈" },
  { id: "mythic", kind: "title", level: 75, name: "Mythic", emoji: "🐉" },
];

export function isUnlocked(reward: Reward, level: number, bestStreak: number): boolean {
  return level >= reward.level || (reward.kind === "flame" && reward.streak !== undefined && bestStreak >= reward.streak);
}

/** Rewards newly unlocked when going from one level to another. */
export function rewardsBetween(fromLevel: number, toLevel: number): Reward[] {
  return REWARDS.filter((r) => r.level > fromLevel && r.level <= toLevel);
}

export const titleName = (id: string) => REWARDS.find((r) => r.kind === "title" && r.id === id)?.name ?? "Rookie";

/** CSS filter that recolors the 🔥 emoji for each flame style. */
export const FLAME_FILTERS: Record<FlameStyle, string> = {
  classic: "none",
  blue: "hue-rotate(190deg) saturate(1.4)",
  green: "hue-rotate(80deg) saturate(1.3)",
  purple: "hue-rotate(250deg) saturate(1.6)",
  gold: "hue-rotate(20deg) saturate(1.8) brightness(1.15)",
  rainbow: "hue-rotate(var(--rainbow-hue, 0deg)) saturate(1.6)",
};

/**
 * XP for finishing one block at `completedAt`, by the same rules as the
 * database's award_completion(). Used for the instant (optimistic) number
 * and in demo mode; signed in, the server's answer replaces it.
 * `blocks` = the schedule BEFORE this block was marked done.
 */
export function xpForCompletion(blocks: PlannedBlock[], completedAt: number, timeZone: string): number {
  const today = dayKey(completedAt, timeZone);
  const doneToday = blocks.filter((b) => b.status === "done" && b.completedAt !== null && dayKey(b.completedAt, timeZone) === today).length;
  if (doneToday >= XP.dailyCap) return 0;
  let xp = XP.complete;
  if (minuteOfDay(completedAt, timeZone) < XP.earlyBeforeMinute) xp += XP.early;
  if (doneToday === 0) {
    const days = completionDays(blocks, timeZone);
    days.add(today);
    xp += streakBonus(currentStreak(days, today));
  }
  return xp;
}
