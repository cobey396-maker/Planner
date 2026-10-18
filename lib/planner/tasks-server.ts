import "server-only";
import { z } from "zod";
import { TASK_COLOR_NAMES, type TaskColor } from "@/lib/design/tokens";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, dayKey as toDayKey, dayRange } from "@/lib/tz";
import { MAX_DAYS_AHEAD, MAX_OCCURRENCES, placeMany, placeTask, type SkippedDay } from "./placement";
import type { Interval, PlannedBlock } from "./types";

/**
 * TASK WRITES, shared by the server actions (app/actions/planner.ts) and the
 * Schedule Helper's tools (app/api/helper/route.ts), so both follow exactly
 * the same rules. Every query uses the caller's own token: row-level
 * security still decides what they can touch.
 */

type Supabase = NonNullable<ServerSupabase>;
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31");

export const newTaskSchema = z.object({
  title: z.string().trim().min(1, "Give your task a name").max(80, "Keep the name under 80 characters"),
  minutes: z.number().int().min(15, "At least 15 minutes").max(480, "At most 8 hours"),
  color: z.enum(TASK_COLOR_NAMES as [TaskColor, ...TaskColor[]]),
  /** One day, several picked days, or the days of a repeating rule. */
  dayKeys: z.array(dayKeySchema).min(1, "Pick at least one day").max(MAX_OCCURRENCES, `At most ${MAX_OCCURRENCES} days at once`),
  /** Exact local start (minutes after midnight), or null to auto-place. */
  startMinute: z.number().int().min(0).max(1439).nullable(),
});
export type NewTaskInput = z.infer<typeof newTaskSchema>;

export async function userTimeZone(supabase: Supabase, userId: string): Promise<string> {
  const { data } = await supabase.from("user_settings").select("time_zone").eq("user_id", userId).single();
  return (data as { time_zone: string } | null)?.time_zone ?? "UTC";
}

/** Busy time between two instants (anything not skipped). */
async function busyBetween(supabase: Supabase, start: number, end: number, exceptBlockId?: string): Promise<Interval[]> {
  let query = supabase
    .from("blocks")
    .select("id, starts_at, ends_at")
    .lt("starts_at", new Date(end).toISOString())
    .gt("ends_at", new Date(start).toISOString())
    .neq("status", "skipped");
  if (exceptBlockId) query = query.neq("id", exceptBlockId);
  const { data } = await query;
  return ((data ?? []) as { starts_at: string; ends_at: string }[]).map((b) => ({
    start: Date.parse(b.starts_at),
    end: Date.parse(b.ends_at),
  }));
}

type BlockRow = {
  id: string;
  task_id: string;
  starts_at: string;
  ends_at: string;
  status: PlannedBlock["status"];
  completed_at: string | null;
  tasks: { title: string; color: TaskColor } | null;
};
export const BLOCK_FIELDS = "id, task_id, starts_at, ends_at, status, completed_at, tasks(title, color)";

export function toPlannedBlock(b: BlockRow): PlannedBlock {
  return {
    id: b.id,
    taskId: b.task_id,
    title: b.tasks?.title ?? "Task",
    color: b.tasks?.color ?? "orange",
    startsAt: Date.parse(b.starts_at),
    endsAt: Date.parse(b.ends_at),
    status: b.status,
    completedAt: b.completed_at ? Date.parse(b.completed_at) : null,
  };
}

/** Blocks starting in [start, end), oldest first. */
export async function blocksBetween(supabase: Supabase, start: number, end: number): Promise<PlannedBlock[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_FIELDS)
    .gte("starts_at", new Date(start).toISOString())
    .lt("starts_at", new Date(end).toISOString())
    .order("starts_at");
  if (error) console.error("[planner] loading blocks failed:", error.code, error.message);
  return ((data ?? []) as unknown as BlockRow[]).map(toPlannedBlock);
}

const FK_VIOLATION = "23503";

/**
 * Create one task with a block on each requested day. Days that can't fit
 * are reported in `skipped` (with the reason) rather than failing the lot.
 */
export async function createTask(
  supabase: Supabase,
  userId: string,
  input: NewTaskInput,
  now = Date.now(),
): Promise<Result<{ blocks: PlannedBlock[]; skipped: SkippedDay[] }>> {
  const parsed = newTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the task details." };
  const v = parsed.data;
  const timeZone = await userTimeZone(supabase, userId);

  const days = [...new Set(v.dayKeys)].sort();
  const lastAllowed = addDays(toDayKey(now, timeZone), MAX_DAYS_AHEAD);
  if (days.at(-1)! > lastAllowed) return { ok: false, error: "You can plan up to a year ahead." };

  const busy = await busyBetween(supabase, dayRange(days[0], timeZone).start, dayRange(days.at(-1)!, timeZone).end);
  const { placed, skipped } = placeMany({ dayKeys: days, minutes: v.minutes, startMinute: v.startMinute, timeZone, now, busy });
  if (placed.length === 0) return { ok: false, error: skipped[0]?.error ?? "No open time on those days." };

  const insertTask = () =>
    supabase
      .from("tasks")
      .insert({ user_id: userId, title: v.title, color: v.color, estimated_minutes: v.minutes, min_session_minutes: Math.min(30, v.minutes) })
      .select("id")
      .single();
  let task = await insertTask();
  if (task.error?.code === FK_VIOLATION) {
    // This account is missing its profile row (see migration 3): repair, retry once.
    await supabase.rpc("ensure_my_account");
    task = await insertTask();
  }
  if (task.error || !task.data) {
    // Printed in the terminal running the app, to help diagnose problems.
    console.error("[planner] saving a task failed:", task.error?.code, task.error?.message);
    return { ok: false, error: "Couldn't save the task. Please try again." };
  }
  const taskId = (task.data as { id: string }).id;

  const { data: rows, error } = await supabase
    .from("blocks")
    .insert(
      placed.map((p) => ({
        user_id: userId,
        task_id: taskId,
        starts_at: new Date(p.startsAt).toISOString(),
        ends_at: new Date(p.endsAt).toISOString(),
      })),
    )
    .select("id, starts_at");
  if (error || !rows) {
    console.error("[planner] saving blocks failed:", error?.code, error?.message);
    // Undo the task so we don't leave an orphan (e.g. another tab grabbed
    // the same time a split second earlier: the no-overlap rule caught it).
    await supabase.from("tasks").delete().eq("id", taskId);
    return { ok: false, error: "That time just got taken. Please try again." };
  }

  const idByStart = new Map((rows as { id: string; starts_at: string }[]).map((r) => [Date.parse(r.starts_at), r.id]));
  const blocks: PlannedBlock[] = placed.map((p) => ({
    id: idByStart.get(p.startsAt)!,
    taskId,
    title: v.title,
    color: v.color,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    status: "planned",
    completedAt: null,
  }));
  return { ok: true, blocks, skipped };
}

export const uuid = z.string().uuid();

/** Delete one occurrence. The last block of a task takes the task with it. */
export async function deleteBlock(supabase: Supabase, blockId: string): Promise<Result<{ taskId: string }>> {
  if (!uuid.safeParse(blockId).success) return { ok: false, error: "Unknown block." };
  const { data, error } = await supabase.from("blocks").delete().eq("id", blockId).select("task_id");
  const row = (data as { task_id: string }[] | null)?.[0];
  if (error || !row) return { ok: false, error: "Couldn't delete it. Please try again." };
  const { count } = await supabase.from("blocks").select("id", { count: "exact", head: true }).eq("task_id", row.task_id);
  if (count === 0) await supabase.from("tasks").delete().eq("id", row.task_id);
  return { ok: true, taskId: row.task_id };
}

/** Delete a task and every one of its blocks (a whole repeating series). */
export async function deleteTask(supabase: Supabase, taskId: string): Promise<Result> {
  if (!uuid.safeParse(taskId).success) return { ok: false, error: "Unknown task." };
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  return error ? { ok: false, error: "Couldn't delete it. Please try again." } : { ok: true };
}

/** Move one block to a new day and time (same length). */
export async function moveBlock(
  supabase: Supabase,
  userId: string,
  blockId: string,
  dayKey: string,
  startMinute: number | null,
  now = Date.now(),
): Promise<Result<{ startsAt: number; endsAt: number }>> {
  if (!uuid.safeParse(blockId).success || !dayKeySchema.safeParse(dayKey).success) return { ok: false, error: "Unknown block or day." };
  const { data } = await supabase.from("blocks").select("starts_at, ends_at").eq("id", blockId).single();
  if (!data) return { ok: false, error: "Unknown block." };
  const b = data as { starts_at: string; ends_at: string };
  const minutes = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000);

  const timeZone = await userTimeZone(supabase, userId);
  const range = dayRange(dayKey, timeZone);
  const busy = await busyBetween(supabase, range.start, range.end, blockId);
  const slot = placeTask({ dayKey, minutes, startMinute, timeZone, now, busy });
  if (!slot.ok) return slot;
  const { error } = await supabase
    .from("blocks")
    .update({ starts_at: new Date(slot.startsAt).toISOString(), ends_at: new Date(slot.endsAt).toISOString() })
    .eq("id", blockId);
  if (error) return { ok: false, error: "Couldn't move it. Please try again." };
  return { ok: true, startsAt: slot.startsAt, endsAt: slot.endsAt };
}

/** Your XP total (the sum of your ledger; RLS shows only your own rows). */
export async function xpTotal(supabase: Supabase): Promise<number> {
  const { data } = await supabase.from("points_ledger").select("points");
  return ((data ?? []) as { points: number }[]).reduce((sum, r) => sum + r.points, 0);
}

/** Mark a block done (the server awards XP) or not done (takes it back). */
export async function setBlockDone(supabase: Supabase, blockId: string, done: boolean): Promise<Result<{ xp: number; total: number }>> {
  if (!uuid.safeParse(blockId).success) return { ok: false, error: "Unknown block." };
  const { data, error } = await supabase.rpc(done ? "complete_block" : "uncomplete_block", { block: blockId });
  if (error) return { ok: false, error: done ? "Couldn't mark it done." : "Couldn't undo that." };
  return { ok: true, xp: done ? ((data as number | null) ?? 0) : 0, total: await xpTotal(supabase) };
}
