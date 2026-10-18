import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { scheduleTools } from "@/lib/helper/tools";
import { getAccount } from "@/lib/auth/session";
import { hasFeature } from "@/lib/plans";
import { blocksBetween, userTimeZone } from "@/lib/planner/tasks-server";
import { createClient } from "@/lib/supabase/server";
import { formatDayKey } from "@/lib/time";
import { dayKey } from "@/lib/tz";

/**
 * SCHEDULE HELPER: a chat with Claude that can read and change your schedule.
 *
 * The browser sends the conversation so far (text only); we run Claude with
 * the tools in lib/helper/tools.ts until it has an answer, and stream back
 * newline-delimited JSON events as they happen:
 *   {"type":"text","text":"…"}       a piece of Claude's reply
 *   {"type":"activity","label":"…"}  a tool is running ("Adding Gym")
 *   {"type":"blocks","blocks":[…]}   the schedule changed: fresh blocks
 *   {"type":"error","error":"…"}
 *   {"type":"done"}
 *
 * The API key lives only on the server (ANTHROPIC_API_KEY in .env.local);
 * the browser never sees it.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be from the user"),
});

/** A simple per-user limit so one account can't run up the bill. Per server instance. */
const RATE_LIMIT = { max: 40, windowMs: 60 * 60 * 1000 };
const recent = new Map<string, number[]>();
function rateLimited(userId: string, now: number) {
  const times = (recent.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (times.length >= RATE_LIMIT.max) return true;
  recent.set(userId, [...times, now]);
  return false;
}

// Stable instructions first (cache-friendly); today's details go in a second block.
const INSTRUCTIONS = `You are Schedule Helper, the assistant inside Auto-Planner, a scheduling app for students and busy people.
You help the user plan their time: adding tasks, setting up repeating routines, finding free time, moving things, and answering questions about their schedule.

How to work:
- Use the tools to read and change the schedule. Never claim you changed something unless a tool result confirms it.
- Get ids from get_schedule before moving, completing or deleting blocks.
- Resolve relative dates ("tomorrow", "next Friday", "every Monday for a month") against today's date below, in the user's time zone.
- When the user gives a time, pass it as start_time. When they don't, leave it out and the app finds the first open time.
- For routines (e.g. "gym at 5 every Monday, Thursday and Friday"), use add_task with repeat. If no end is given, plan 4 weeks and say so.
- Ask a short clarifying question only when you can't make a sensible choice (e.g. they didn't say how long a task takes and there's no obvious default; one hour is a fine default for most tasks).
- Before deleting a whole repeating series or more than one block, confirm unless the user clearly asked for it.
- If some days were skipped because they were full or already over, say which.

Style: friendly, brief, plain language. Use short sentences and, for lists of times, a compact list. Times in 12-hour format like "5:00 PM". No markdown headings.

You only manage this user's schedule. Politely decline unrelated requests and steer back to planning.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Schedule Helper isn't set up yet: add ANTHROPIC_API_KEY to .env.local and restart." }, { status: 503 });
  }
  const account = await getAccount();
  const supabase = await createClient();
  if (!account || !supabase) return Response.json({ error: "Sign in to use Schedule Helper." }, { status: 401 });
  if (!hasFeature("schedule_helper", account)) return Response.json({ error: "Schedule Helper is a paid feature." }, { status: 402 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const now = Date.now();
  if (rateLimited(account.id, now)) {
    return Response.json({ error: "That's a lot of requests. Take a breather and try again in a bit." }, { status: 429 });
  }

  const timeZone = await userTimeZone(supabase, account.id);
  const today = dayKey(now, timeZone);
  const localNow = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
  const context = `Today is ${formatDayKey(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} (${today}). It's ${localNow} in the user's time zone, ${timeZone}. The user's name is ${account.displayName}.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let changed = false;
      try {
        const client = new Anthropic();
        const runner = client.beta.messages.toolRunner({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: "medium" },
          // If a safety classifier declines, retry on a fallback model automatically.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          max_iterations: 10,
          system: [
            { type: "text", text: INSTRUCTIONS },
            { type: "text", text: context },
          ],
          tools: scheduleTools({
            supabase,
            userId: account.id,
            timeZone,
            now,
            onActivity: (label) => send({ type: "activity", label }),
            onChange: () => {
              changed = true;
            },
          }),
          messages: parsed.data.messages,
          stream: true,
        });

        let wroteText = false;
        for await (const messageStream of runner) {
          // Each loop is one model turn (tools run in between). Separate the
          // text of different turns with a blank line.
          let firstInTurn = true;
          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = firstInTurn && wroteText ? `\n\n${event.delta.text.trimStart()}` : event.delta.text;
              firstInTurn = false;
              wroteText = true;
              send({ type: "text", text });
            }
          }
          const message = await messageStream.finalMessage();
          if (message.stop_reason === "refusal") {
            send({ type: "text", text: "\n\nSorry, I can't help with that one. Try asking about your schedule." });
          }
        }

        if (changed) {
          // Send the fresh schedule so every tab updates right away.
          const blocks = await blocksBetween(supabase, now - 400 * 86_400_000, now + 400 * 86_400_000);
          send({ type: "blocks", blocks });
        }
        send({ type: "done" });
      } catch (error) {
        if (changed) {
          const blocks = await blocksBetween(supabase, now - 400 * 86_400_000, now + 400 * 86_400_000).catch(() => null);
          if (blocks) send({ type: "blocks", blocks });
        }
        send({ type: "error", error: friendlyError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

function friendlyError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The Schedule Helper's API key isn't valid. Check ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.PermissionDeniedError) return "The API key doesn't have access to this model.";
  if (error instanceof Anthropic.RateLimitError) return "The helper is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach the AI service. Check your connection.";
  if (error instanceof Anthropic.APIError) return `The AI service had a problem (${error.status ?? "unknown"}). Try again.`;
  console.error("Schedule Helper error", error);
  return "Something went wrong. Try again.";
}
