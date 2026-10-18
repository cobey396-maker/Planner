"use client";

import { ArrowUp, Loader2, Lock, RotateCcw, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { cn } from "@/lib/cn";
import { fadeUp, fluid } from "@/lib/design/motion";
import { usePlanner } from "@/lib/planner/store";
import type { PlannedBlock } from "@/lib/planner/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Gym at 5 PM every Monday, Thursday and Friday",
  "What's on my schedule this week?",
  "Find 2 hours to study tomorrow",
  "Move my next task to tomorrow morning",
];

/** The conversation survives tab switches (but not closing the tab). */
const STORAGE_KEY = "helper-chat";
function loadChat(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

/**
 * SCHEDULE HELPER: chat with Claude about your schedule. It can add tasks
 * (including repeating ones), find free time, move, finish and delete
 * blocks. Replies stream in word by word; whatever it changes shows up on
 * every tab immediately.
 *
 * Needs an account (it works on your saved schedule) and, later, a paid plan.
 */
export function HelperScreen({ configured, allowed }: { configured: boolean; allowed: boolean }) {
  const { mode, replaceBlocks, syncBlocks } = usePlanner();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Restore the chat after mount (sessionStorage only exists in the browser).
  useEffect(() => {
    const saved = loadChat();
    if (saved.length) setMessages(saved);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activity]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    const appendReply = (chunk: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
        return next;
      });

    try {
      const res = await fetch("/api/helper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only the last 20 messages: enough context, and it keeps each request small.
        body: JSON.stringify({ messages: history.slice(-20) }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Try again.");
      }
      // Read the newline-delimited JSON events as they arrive.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "text"; text: string }
            | { type: "activity"; label: string }
            | { type: "blocks"; blocks: PlannedBlock[] }
            | { type: "error"; error: string }
            | { type: "done" };
          if (event.type === "text") {
            setActivity(null);
            appendReply(event.text);
          } else if (event.type === "activity") setActivity(event.label);
          else if (event.type === "blocks") replaceBlocks(event.blocks);
          else if (event.type === "error") setError(event.error);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the server.");
    } finally {
      // Whatever happened, make every tab match what's saved now.
      void syncBlocks();
      setBusy(false);
      setActivity(null);
      // Drop an empty reply bubble if nothing came back.
      setMessages((prev) => (prev.at(-1)?.role === "assistant" && !prev.at(-1)?.content ? prev.slice(0, -1) : prev));
    }
  }

  const locked = mode === "local" || !allowed;

  return (
    <LargeTitlePage
      title="Schedule Helper"
      subtitle="Tell it what you need. It plans it for you."
      trailing={
        messages.length > 0 && !busy ? (
          <Button variant="glass" size="icon" aria-label="New conversation" onClick={() => setMessages([])}>
            <RotateCcw size={19} className="text-tint" />
          </Button>
        ) : undefined
      }
    >
      {locked ? (
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-tint/12 text-tint">
            <Lock size={24} />
          </span>
          <h2 className="mt-4 text-title3">Schedule Helper needs an account</h2>
          <p className="mt-1 max-w-xs text-subhead text-secondary-label">
            It works on your saved schedule. Create a free account to try it.
          </p>
          <Link href="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-tint px-5 text-headline text-on-tint">
            Create an account
          </Link>
        </Card>
      ) : !configured ? (
        <Card className="text-subhead text-secondary-label">
          <p className="text-headline text-label">Almost ready</p>
          <p className="mt-1">
            Schedule Helper needs an Anthropic API key on the server. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> and restart the app (see README).
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 pb-28">
          {messages.length === 0 && (
            <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex flex-col gap-3">
              <Card className="flex items-start gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-tint text-on-tint">
                  <Sparkles size={20} />
                </span>
                <p className="text-body">
                  Hi! I can add tasks, set up routines like the gym three times a week, find free time, and move things around.
                  What do you need?
                </p>
              </Card>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="glass-card rounded-2xl px-4 py-3 text-left text-subhead text-tint"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fluid}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-body",
                  m.role === "user" ? "self-end bg-tint text-on-tint" : "glass-card self-start",
                )}
                data-role={m.role}
              >
                {m.content || <Loader2 aria-label="Thinking" size={18} className="animate-spin text-secondary-label" />}
              </motion.div>
            ))}
          </AnimatePresence>

          {activity && (
            <p className="flex items-center gap-2 px-1 text-footnote text-secondary-label" role="status">
              <Loader2 aria-hidden size={14} className="animate-spin" /> {activity}…
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger">
              {error}
            </p>
          )}
          <div ref={bottom} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="pb-safe fixed inset-x-0 bottom-[5.5rem] z-20 mx-auto flex max-w-md items-end gap-2 px-4"
          >
            <label className="glass-pill flex min-h-12 flex-1 items-center rounded-3xl px-4">
              <span className="sr-only">Message Schedule Helper</span>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Plan gym at 5 every Mon, Thu, Fri…"
                className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-3 text-body outline-none placeholder:text-tertiary-label"
              />
            </label>
            <Button type="submit" size="icon" aria-label="Send" disabled={busy || !input.trim()} className="size-12">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={22} />}
            </Button>
          </form>
        </div>
      )}
    </LargeTitlePage>
  );
}
