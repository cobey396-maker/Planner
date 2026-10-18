"use client";

import { Clock, Loader2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { fluid } from "@/lib/design/motion";
import { TASK_COLOR_NAMES, TASK_COLORS, type TaskColor } from "@/lib/design/tokens";
import { usePlanner } from "@/lib/planner/store";
import { formatClock, formatDayKey, formatDuration, formatTime } from "@/lib/time";
import { addDays } from "@/lib/tz";

const DURATIONS = [15, 30, 60, 90, 120, 180];
/** Every 15 minutes, all day: planning is 24/7. */
const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);

/**
 * ADD A TASK. Name, length, which day, and optionally an exact time.
 * "Auto" puts it in the first open slot (from now if it's today, from 8 AM
 * on other days). The natural-language bar on top arrives in Phase 7.
 */
export function AddTaskSheet({
  open,
  onOpenChange,
  today,
  initialDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Today's day key in the user's time zone. */
  today: string;
  /** Pre-selected day (e.g. the day you're looking at on Week). */
  initialDay?: string;
}) {
  const { addTask, timeZone } = usePlanner();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [day, setDay] = useState(initialDay && initialDay >= today ? initialDay : today);
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [color, setColor] = useState<TaskColor>("orange");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  // Keep the chosen day valid if the sheet is reopened from another day.
  const selectedDay = days.includes(day) ? day : today;

  async function submit() {
    if (!title.trim()) {
      setError("Give your task a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addTask({ title, minutes, color, dayKey: selectedDay, startMinute });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const label = selectedDay === today ? "today" : formatDayKey(selectedDay, { weekday: "short" });
    toast(`Planned for ${label} at ${formatTime(result.block.startsAt, timeZone)}`);
    setTitle("");
    setStartMinute(null);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New task" description="Tell it what you need to do.">
      <form
        className="flex flex-col gap-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-footnote font-medium text-secondary-label">Task</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder="Study for chem test"
            maxLength={80}
            className="h-12 rounded-2xl bg-fill px-4 text-body outline-none placeholder:text-tertiary-label focus:ring-2 focus:ring-tint"
          />
        </label>

        <ChipRow label="How long?">
          {DURATIONS.map((m) => (
            <Chip key={m} group="duration" selected={minutes === m} onClick={() => setMinutes(m)}>
              {formatDuration(m)}
            </Chip>
          ))}
        </ChipRow>

        <ChipRow label="Which day?">
          {days.map((d) => (
            <Chip key={d} group="day" selected={selectedDay === d} onClick={() => setDay(d)}>
              {d === today
                ? "Today"
                : d === addDays(today, 1)
                  ? "Tomorrow"
                  : formatDayKey(d, { weekday: "short", month: "short", day: "numeric" })}
            </Chip>
          ))}
        </ChipRow>

        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-footnote font-medium text-secondary-label">What time?</span>
          <span className="flex h-12 items-center gap-2 rounded-2xl bg-fill px-4">
            <Clock aria-hidden size={18} className="shrink-0 text-tint" />
            <select
              aria-label="Start time"
              value={startMinute ?? "auto"}
              onChange={(e) => setStartMinute(e.target.value === "auto" ? null : Number(e.target.value))}
              className="min-w-0 flex-1 bg-transparent text-body outline-none"
            >
              <option value="auto">Auto: first open time</option>
              {TIMES.map((m) => (
                <option key={m} value={m}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
          </span>
        </label>

        <div>
          <span className="px-1 text-footnote font-medium text-secondary-label">Color</span>
          <div className="mt-2 flex flex-wrap gap-2.5 px-1" role="radiogroup" aria-label="Color">
            {TASK_COLOR_NAMES.map((c) => (
              <motion.button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={TASK_COLORS[c].label}
                onClick={() => setColor(c)}
                whileTap={{ scale: 0.85 }}
                animate={{ scale: color === c ? 1.15 : 1 }}
                transition={fluid}
                className="size-8 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
                style={{
                  background: `var(--task-${c})`,
                  outline: color === c ? `2px solid var(--task-${c})` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={saving}>
          {saving ? (
            <Loader2 aria-hidden size={20} className="animate-spin" />
          ) : (
            <>
              <Sparkles aria-hidden size={18} /> Plan it
            </>
          )}
        </Button>
      </form>
    </Sheet>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="px-1 text-footnote font-medium text-secondary-label">{label}</span>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">{children}</div>
    </div>
  );
}
