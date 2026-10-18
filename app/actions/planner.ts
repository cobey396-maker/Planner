"use server";

import { z } from "zod";
import { TASK_COLOR_NAMES, type TaskColor } from "@/lib/design/tokens";
import { appUrl, sendEmail } from "@/lib/email/send";
import { friendRequestEmail } from "@/lib/email/templates";
import { placeTask } from "@/lib/planner/placement";
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

const newTaskSchema = z.object({
  title: z.string().trim().min(1, "Give your task a name").max(80),
  minutes: z.number().int().min(15).max(480),
  color: z.enum(TASK_COLOR_NAMES as [TaskColor, ...TaskColor[]]),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1439).nullable(),
});
export type NewTaskInput = z.infer<typeof newTaskSchema>;

export async function createTaskAction(input: NewTaskInput): Promise<Result<{ block: PlannedBlock }>> {
  const parsed = newTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the task details." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { supabase, userId } = session;
  const v = parsed.data;

  const { data: settings } = await supabase.from("user_settings").select("time_zone").eq("user_id", userId).single();
  const timeZone = (settings as { time_zone: string } | null)?.time_zone ?? "UTC";
  const range = dayRange(v.dayKey, timeZone);

  // What's already planned that day (overlapping it at all).
  const { data: existing } = await supabase
    .from("blocks")
    .select("starts_at, ends_at")
    .lt("starts_at", new Date(range.end).toISOString())
    .gt("ends_at", new Date(range.start).toISOString())
    .neq("status", "skipped");
  const busy: Interval[] = ((existing ?? []) as { starts_at: string; ends_at: string }[]).map((b) => ({
    start: Date.parse(b.starts_at),
    end: Date.parse(b.ends_at),
  }));

  const slot = placeTask({ dayKey: v.dayKey, minutes: v.minutes, startMinute: v.startMinute, timeZone, now: Date.now(), busy });
  if (!slot.ok) return slot;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({ user_id: userId, title: v.title, color: v.color, estimated_minutes: v.minutes, min_session_minutes: Math.min(30, v.minutes) })
    .select("id")
    .single();
  if (taskError || !task) return { ok: false, error: "Couldn't save the task. Please try again." };

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .insert({ user_id: userId, task_id: task.id, starts_at: new Date(slot.startsAt).toISOString(), ends_at: new Date(slot.endsAt).toISOString() })
    .select("id")
    .single();
  if (blockError || !block) {
    // Undo the task so we don't leave an orphan (e.g. another tab grabbed
    // the same time a split second earlier: the no-overlap rule caught it).
    await supabase.from("tasks").delete().eq("id", task.id);
    return { ok: false, error: "That time just got taken. Please try again." };
  }

  return {
    ok: true,
    block: { id: block.id, taskId: task.id, title: v.title, color: v.color, startsAt: slot.startsAt, endsAt: slot.endsAt, status: "planned", completedAt: null },
  };
}

const uuid = z.string().uuid();

export async function setBlockDoneAction(blockId: string, done: boolean): Promise<Result<{ points: number; completedAt: number | null }>> {
  if (!uuid.safeParse(blockId).success) return { ok: false, error: "Unknown block." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  if (done) {
    const { data, error } = await session.supabase.rpc("complete_block", { block: blockId });
    if (error) return { ok: false, error: "Couldn't mark it done. Please try again." };
    return { ok: true, points: (data as number) ?? 0, completedAt: Date.now() };
  }
  const { error } = await session.supabase.rpc("uncomplete_block", { block: blockId });
  if (error) return { ok: false, error: "Couldn't undo that. Please try again." };
  return { ok: true, points: 0, completedAt: null };
}

export async function deleteTaskAction(taskId: string): Promise<Result> {
  if (!uuid.safeParse(taskId).success) return { ok: false, error: "Unknown task." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const { error } = await session.supabase.from("tasks").delete().eq("id", taskId);
  return error ? { ok: false, error: "Couldn't delete it. Please try again." } : { ok: true };
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
