"use server";

import { z } from "zod";
import { appUrl, sendEmail } from "@/lib/email/send";
import { friendRequestEmail } from "@/lib/email/templates";
import type { SkippedDay } from "@/lib/planner/placement";
import { leaderboard } from "@/lib/planner/load";
import { blocksBetween, createTask, deleteBlock, deleteTask, setBlockDone, xpTotal, type NewTaskInput } from "@/lib/planner/tasks-server";
import type { LeaderRow } from "@/lib/planner/types";
import type { Interval, PlannedBlock } from "@/lib/planner/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dayRange } from "@/lib/tz";

/**
 * PLANNER SERVER ACTIONS
 * Each one: check who's asking (verified token), validate input with zod,
 * then read/write with the user's own token so RLS applies.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function signedIn() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}
const SESSION_EXPIRED = { ok: false as const, error: "Your session expired. Please sign in again." };

export type { NewTaskInput };

/** One task on one or more days (a repeating task is one task with many blocks). */
export async function createTaskAction(input: NewTaskInput): Promise<Result<{ blocks: PlannedBlock[]; skipped: SkippedDay[] }>> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  return createTask(session.supabase, session.userId, input);
}

const uuid = z.string().uuid();

export async function setBlockDoneAction(blockId: string, done: boolean): Promise<Result<{ xp: number; total: number }>> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  return setBlockDone(session.supabase, blockId, done);
}

/** Delete a whole task (every occurrence of a repeating one). */
export async function deleteTaskAction(taskId: string): Promise<Result> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  return deleteTask(session.supabase, taskId);
}

/**
 * Your blocks from the database (the past ~400 days and the next ~400), so
 * every tab can re-sync with what's actually saved.
 */
export async function loadBlocksAction(): Promise<Result<{ blocks: PlannedBlock[]; xp: number }>> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const now = Date.now();
  const [blocks, xp] = await Promise.all([
    blocksBetween(session.supabase, now - 400 * 86_400_000, now + 400 * 86_400_000),
    xpTotal(session.supabase),
  ]);
  return { ok: true, blocks, xp };
}

/** You and your friends, ranked by XP since `weekStart` (epoch ms). */
export async function leaderboardAction(weekStart: number): Promise<Result<{ rows: LeaderRow[] }>> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  return { ok: true, rows: await leaderboard(session.supabase, weekStart) };
}

/** Delete just one occurrence. */
export async function deleteBlockAction(blockId: string): Promise<Result> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  return deleteBlock(session.supabase, blockId);
}

/** Best-effort "you have a friend request" email (needs the server email setup). */
async function emailFriendRequest(friendshipId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin.rpc("friend_request_email", { friendship: friendshipId });
  const row = (data as { email: string; recipient_name: string; requester_name: string }[] | null)?.[0];
  if (row) {
    await sendEmail(row.email, friendRequestEmail({ recipient: row.recipient_name, requester: row.requester_name, appUrl: appUrl() }));
  }
}

export async function requestFriendAction(targetId: string): Promise<Result> {
  if (!uuid.safeParse(targetId).success) return { ok: false, error: "Unknown person." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { data, error } = await session.supabase.rpc("send_friend_request_to", { target: targetId });
  if (error) return { ok: false, error: "Couldn't send the request." };
  await emailFriendRequest(data as string);
  return { ok: true };
}

export async function requestFriendByCodeAction(code: string): Promise<Result> {
  if (!/^[a-f0-9]{12}$/.test(code)) return { ok: false, error: "That invite link isn't valid." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { data, error } = await session.supabase.rpc("send_friend_request", { code });
  if (error) {
    return { ok: false, error: error.message.includes("own invite") ? "That's your own invite link." : "That invite link isn't valid." };
  }
  await emailFriendRequest(data as string);
  return { ok: true };
}

export async function respondFriendAction(friendshipId: string, accept: boolean): Promise<Result> {
  if (!uuid.safeParse(friendshipId).success) return { ok: false, error: "Unknown request." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { error } = await session.supabase.rpc("respond_friend_request", { request_id: friendshipId, accept });
  return error ? { ok: false, error: "That request is no longer available." } : { ok: true };
}

/** A friend's busy times on a local day (start/end only; that's all the database returns). */
export async function friendBusyAction(friendId: string, dayKey: string): Promise<Result<{ busy: Interval[]; mine: Interval[] }>> {
  if (!uuid.safeParse(friendId).success || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return { ok: false, error: "Bad request." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { supabase, userId } = session;
  const { data: settings } = await supabase.from("user_settings").select("time_zone").eq("user_id", userId).single();
  const range = dayRange(dayKey, (settings as { time_zone: string } | null)?.time_zone ?? "UTC");
  const [theirs, mine] = await Promise.all([
    supabase.rpc("friend_busy_intervals", {
      friend: friendId,
      range_start: new Date(range.start).toISOString(),
      range_end: new Date(range.end).toISOString(),
    }),
    supabase
      .from("blocks")
      .select("starts_at, ends_at")
      .lt("starts_at", new Date(range.end).toISOString())
      .gt("ends_at", new Date(range.start).toISOString()),
  ]);
  const toIntervals = (rows: unknown) =>
    ((rows ?? []) as { starts_at: string; ends_at: string }[]).map((r) => ({ start: Date.parse(r.starts_at), end: Date.parse(r.ends_at) }));
  return { ok: true, busy: toIntervals(theirs.data), mine: toIntervals(mine.data) };
}

const hangoutSchema = z.object({
  friendId: uuid,
  startsAt: z.number().int(),
  endsAt: z.number().int(),
  activity: z.string().trim().min(1).max(40),
});

export async function sendHangoutAction(input: z.infer<typeof hangoutSchema>): Promise<Result> {
  const parsed = hangoutSchema.safeParse(input);
  if (!parsed.success || parsed.data.endsAt <= parsed.data.startsAt) return { ok: false, error: "Pick a time first." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const v = parsed.data;
  const { error } = await session.supabase.from("hangout_invites").insert({
    from_user_id: session.userId,
    to_user_id: v.friendId,
    starts_at: new Date(v.startsAt).toISOString(),
    ends_at: new Date(v.endsAt).toISOString(),
    activity: v.activity,
  });
  return error ? { ok: false, error: "Couldn't send the invite." } : { ok: true };
}

export async function respondHangoutAction(inviteId: string, accept: boolean): Promise<Result> {
  if (!uuid.safeParse(inviteId).success) return { ok: false, error: "Unknown invite." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { error } = await session.supabase
    .from("hangout_invites")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", inviteId);
  return error ? { ok: false, error: "Couldn't answer the invite." } : { ok: true };
}
