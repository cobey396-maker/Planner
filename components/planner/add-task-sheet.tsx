"use client";

import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { fluid } from "@/lib/design/motion";
import { TASK_COLOR_NAMES, TASK_COLORS, type TaskColor } from "@/lib/design/tokens";
import { DAY_END, usePlanner } from "@/lib/planner/store";
import { formatClock, formatDuration, WEEKDAY_SHORT } from "@/lib/time";

const DURATIONS = [30, 60, 90, 120, 180];

/**
 * The Add Task sheet. The natural-language bar sits on top (Claude parses it
 * in Phase 7); below it, the manual form that works today. "Plan it" asks the
 * planner for the first free slot and tells you where the task landed.
 */
export function AddTaskSheet({
  open,
  onOpenChange,
  today,
  nowMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Index of today, 0 = Monday. */
  today: number;
  nowMinutes: number;
}) {
  const { addTask } = usePlanner();
  const toast = useToast();
  // Late at night there's no room left today, so start the choices tomorrow.
  const firstDay = nowMinutes >= DAY_END - 30 && today < 6 ? today + 1 : today;
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [day, setDay] = useState(firstDay);
  const [color, setColor] = useState<TaskColor>("orange");
  const [error, setError] = useState<string | null>(null);

  const days = Array.from({ length: 7 - firstDay }, (_, i) => firstDay + i);

  function submit() {
    const name = title.trim();
    if (!name) {
      setError("Give your task a name first.");
      return;
    }
    // Tasks for today can't be placed in the past.
    const block = addTask({ title: name, minutes, color, day }, day === today ? nowMinutes : undefined);
    if (!block) {
      setError(`No ${formatDuration(minutes)} gap left that day. Try a shorter time or another day.`);
      return;
    }
    toast(`Planned for ${day === today ? "today" : WEEKDAY_SHORT[day]} at ${formatClock(block.start)}`);
    setTitle("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New task" description="Tell it what you need to do.">
      <form
        className="flex flex-col gap-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="glass-card flex items-center gap-2 rounded-2xl px-3">
          <Sparkles aria-hidden size={18} className="shrink-0 text-tint" />
          <input
            disabled
            aria-label="Describe tasks in plain English (coming soon)"
            placeholder="“essay due fri ~3hrs, gym MWF 6pm” · soon"
            className="h-12 w-full bg-transparent text-body outline-none placeholder:text-tertiary-label"
          />
        </div>

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

        <ChipRow label="When?">
          {days.map((d) => (
            <Chip key={d} group="day" selected={day === d} onClick={() => setDay(d)}>
              {d === today ? "Today" : d === today + 1 ? "Tomorrow" : WEEKDAY_SHORT[d]}
            </Chip>
          ))}
        </ChipRow>

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
          <p role="alert" className="px-1 text-subhead text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg">
          <Sparkles aria-hidden size={18} /> Plan it
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
