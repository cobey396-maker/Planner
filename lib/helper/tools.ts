import "server-only";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { TASK_COLOR_NAMES, type TaskColor } from "@/lib/design/tokens";
import { freeWindows } from "@/lib/planner/free-time";
import { MAX_DAYS_AHEAD } from "@/lib/planner/placement";
import { describeRepeat, expandRepeat, type RepeatRule } from "@/lib/planner/repeat";
import { blocksBetween, createTask, deleteBlock, deleteTask, moveBlock, setBlockDone } from "@/lib/planner/tasks-server";
import type { PlannedBlock } from "@/lib/planner/types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { formatTimeRange } from "@/lib/time";
import { addDays, dayKey, dayRange } from "@/lib/tz";

/**
 * THE SCHEDULE HELPER'S TOOLS: the only things Claude can do to a schedule.
 *
 * Each tool is a small function with a zod schema. The SDK turns the schema
 * into the JSON Schema Claude sees, validates every call against it, runs
 * the function, and sends the result back. The functions reuse the exact
 * same code as the app's buttons (lib/planner/tasks-server.ts) and run with
 * the signed-in user's own token, so row-level security still applies:
 * Claude can never touch anyone else's data, and every rule (no overlaps,
 * nothing in the past, at most a year ahead) holds.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("A date as YYYY-MM-DD");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe("24-hour local time as HH:MM, e.g. 17:00");
const toMinute = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export type ToolEvent = { label: string };

export function scheduleTools(opts: {
  supabase: ServerSupabase;
  userId: string;
  timeZone: string;
  now: number;
  /** Shown to the user while a tool runs ("Adding Gym…"). */
  onActivity: (label: string) => void;
  /** Called after anything changes the schedule. */
  onChange: () => void;
}) {
  const { supabase, userId, timeZone, now, onActivity, onChange } = opts;
  const today = dayKey(now, timeZone);
  const describe = (b: PlannedBlock, seriesSize: number) =>
    [
      `id=${b.id}`,
      `${b.startsAt < now ? "past " : ""}${dayKey(b.startsAt, timeZone)} ${formatTimeRange(b.startsAt, b.endsAt, timeZone)}`,
      JSON.stringify(b.title),
      b.status,
      seriesSize > 1 ? `repeating task (${seriesSize} blocks)` : "",
    ]
      .filter(Boolean)
      .join(" | ");

  const getSchedule = betaZodTool({
    name: "get_schedule",
    description:
      "List the user's planned blocks between two dates (inclusive), with each block's id, local date and time, title, status (planned/done/skipped) and whether it belongs to a repeating task. Call this before moving, completing or deleting anything, to get ids. Ranges are limited to 62 days.",
    inputSchema: z.object({ from: day, to: day }),
    run: async ({ from, to }) => {
      if (to < from) return "Error: `to` is before `from`.";
      if (to > addDays(from, 61)) return "Error: ask for at most 62 days at a time.";
      onActivity("Checking your schedule");
      const blocks = await blocksBetween(supabase, dayRange(from, timeZone).start, dayRange(to, timeZone).end);
      if (blocks.length === 0) return `Nothing planned from ${from} to ${to}.`;
      const counts = new Map<string, number>();
      for (const b of blocks) counts.set(b.taskId, (counts.get(b.taskId) ?? 0) + 1);
      return blocks.map((b) => describe(b, counts.get(b.taskId) ?? 1)).join("\n");
    },
  });

  const findFreeTime = betaZodTool({
    name: "find_free_time",
    description:
      "Find open time on one day: returns the free windows of at least `minutes` length, from now (if the day is today) to midnight. Use it to suggest times or to check before placing something at an exact time.",
    inputSchema: z.object({ day, minutes: z.number().int().min(15).max(480) }),
    run: async ({ day: d, minutes }) => {
      if (d < today) return "That day is already over.";
      onActivity("Looking for free time");
      const { start, end } = dayRange(d, timeZone);
      const blocks = await blocksBetween(supabase, start - 86_400_000, end);
      const busy = blocks.filter((b) => b.status !== "skipped").map((b) => ({ start: b.startsAt, end: b.endsAt }));
      const windows = freeWindows(busy, Math.max(start, now), end, minutes * 60_000);
      if (windows.length === 0) return `No free window of ${minutes} minutes on ${d}.`;
      return windows.map((w) => formatTimeRange(w.start, w.end, timeZone)).join("\n");
    },
  });

  const addTask = betaZodTool({
    name: "add_task",
    description: [
      "Add a task to the user's schedule. It can go on ONE day, on SEVERAL specific days, or REPEAT on a weekly pattern.",
      "Give exactly one of `days` (a list of dates) or `repeat`.",
      "`start_time` places it at an exact local time; leave it out to auto-place in the first open time (from now today, from 8 AM on other days).",
      "Days where it doesn't fit are skipped and reported back; tell the user about them.",
      `You can plan up to ${MAX_DAYS_AHEAD} days ahead, at most 120 blocks per call.`,
    ].join(" "),
    inputSchema: z.object({
      title: z.string().min(1).max(80).describe("Short task name, e.g. 'Gym' or 'Study for chem test'"),
      minutes: z.number().int().min(15).max(480).describe("Length of each block in minutes"),
      days: z.array(day).max(120).optional().describe("Specific dates to place it on"),
      repeat: z
        .object({
          pattern: z.enum(["daily", "weekdays", "weekly"]).describe("daily = every day; weekdays = Mon-Fri; weekly = on `weekdays`"),
          weekdays: z
            .array(z.number().int().min(1).max(7))
            .optional()
            .describe("For pattern 'weekly': ISO weekdays, 1 = Monday … 7 = Sunday. E.g. [1, 4, 5] for Mon, Thu, Fri"),
          from: day.describe("First date the pattern may start on"),
          until: day.describe("Last date (inclusive). Default to 4 weeks after `from` if the user didn't say"),
        })
        .optional(),
      start_time: time.optional(),
      color: z.enum(TASK_COLOR_NAMES as [TaskColor, ...TaskColor[]]).optional(),
    }),
    run: async (input) => {
      let dayKeys: string[];
      let summary: string;
      if (input.repeat && !input.days) {
        const r = input.repeat;
        if (r.pattern === "weekly" && !r.weekdays?.length) return "Error: a weekly repeat needs `weekdays`.";
        const rule: RepeatRule =
          r.pattern === "weekly" ? { kind: "weekly", weekdays: r.weekdays! } : { kind: r.pattern };
        dayKeys = expandRepeat(rule, r.from < today ? today : r.from, r.until);
        summary = describeRepeat(rule);
      } else if (input.days && !input.repeat) {
        dayKeys = input.days;
        summary = `on ${input.days.length} day(s)`;
      } else {
        return "Error: give exactly one of `days` or `repeat`.";
      }
      if (dayKeys.length === 0) return "Error: that pattern has no dates in range.";

      onActivity(`Adding ${input.title}`);
      const result = await createTask(
        supabase,
        userId,
        {
          title: input.title,
          minutes: input.minutes,
          color: input.color ?? "orange",
          dayKeys,
          startMinute: input.start_time ? toMinute(input.start_time) : null,
        },
        now,
      );
      if (!result.ok) return `Error: ${result.error}`;
      onChange();
      const placed = result.blocks.map((b) => `${dayKey(b.startsAt, timeZone)} ${formatTimeRange(b.startsAt, b.endsAt, timeZone)}`);
      const skipped = result.skipped.map((s) => `${s.dayKey}: ${s.error}`);
      return [
        `Added "${input.title}" ${summary}: ${result.blocks.length} block(s).`,
        `Placed: ${placed.slice(0, 20).join("; ")}${placed.length > 20 ? ` … and ${placed.length - 20} more` : ""}`,
        skipped.length ? `Skipped ${skipped.length}: ${skipped.join("; ")}` : "Nothing skipped.",
      ].join("\n");
    },
  });

  const moveBlockTool = betaZodTool({
    name: "move_block",
    description:
      "Move one block (by id from get_schedule) to another day and/or time, keeping its length. Leave out start_time to auto-place it on that day.",
    inputSchema: z.object({ block_id: z.string().uuid(), day, start_time: time.optional() }),
    run: async ({ block_id, day: d, start_time }) => {
      onActivity("Moving a block");
      const result = await moveBlock(supabase, userId, block_id, d, start_time ? toMinute(start_time) : null, now);
      if (!result.ok) return `Error: ${result.error}`;
      onChange();
      return `Moved to ${dayKey(result.startsAt, timeZone)} ${formatTimeRange(result.startsAt, result.endsAt, timeZone)}.`;
    },
  });

  const setDone = betaZodTool({
    name: "set_done",
    description: "Mark one block done (the user earns 10 points) or not done. Only do this when the user says they finished it.",
    inputSchema: z.object({ block_id: z.string().uuid(), done: z.boolean() }),
    run: async ({ block_id, done }) => {
      onActivity(done ? "Marking it done" : "Undoing");
      const result = await setBlockDone(supabase, block_id, done);
      if (!result.ok) return `Error: ${result.error}`;
      onChange();
      return done ? "Marked done. +10 points." : "Marked not done.";
    },
  });

  const remove = betaZodTool({
    name: "delete",
    description:
      "Delete a block. scope 'one' deletes just that block; scope 'series' deletes the whole task (every block of a repeating task). Before deleting more than one block, make sure the user asked for that.",
    inputSchema: z.object({ block_id: z.string().uuid(), scope: z.enum(["one", "series"]) }),
    run: async ({ block_id, scope }) => {
      onActivity("Deleting");
      if (scope === "one") {
        const result = await deleteBlock(supabase, block_id);
        if (!result.ok) return `Error: ${result.error}`;
        onChange();
        return "Deleted that block.";
      }
      const { data } = await supabase.from("blocks").select("task_id").eq("id", block_id).single();
      const taskId = (data as { task_id: string } | null)?.task_id;
      if (!taskId) return "Error: unknown block.";
      const result = await deleteTask(supabase, taskId);
      if (!result.ok) return `Error: ${result.error}`;
      onChange();
      return "Deleted the whole task and all its blocks.";
    },
  });

  return [getSchedule, findFreeTime, addTask, moveBlockTool, setDone, remove];
}
