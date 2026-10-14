"use client";

import { Check, Lock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { fluid } from "@/lib/design/motion";
import type { TaskColor } from "@/lib/design/tokens";

/**
 * One colored block on the schedule.
 *
 *   kind="event" — a fixed event you entered (class, work). Lock icon:
 *                  the planner never moves these.
 *   kind="task"  — a work session the auto-planner placed for you.
 *                  Sparkle icon: "the app chose this time".
 *
 * The color comes from the `task-block` utility in globals.css, which reads
 * the CSS variable --block. We set --block inline to var(--task-<color>), so
 * the block automatically switches to the dark-mode shade too.
 *
 * `layout` tells Motion to animate this block to its new position whenever
 * the layout changes. That one prop is what makes the schedule "reflow".
 *
 * `compact` squeezes title and time onto one line, for short blocks in the
 * Week view's hour grid.
 */
export function TaskBlock({
  title,
  timeLabel,
  color,
  kind = "task",
  completed = false,
  compact = false,
  className,
  style,
  onClick,
}: {
  title: string;
  timeLabel: string;
  color: TaskColor;
  kind?: "task" | "event";
  completed?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const Icon = kind === "event" ? Lock : Sparkles;
  return (
    <motion.button
      type="button"
      layout
      transition={fluid}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{ ...style, "--block": `var(--task-${color})` } as CSSProperties}
      className={cn(
        "task-block flex w-full items-start gap-3 overflow-hidden rounded-block text-left",
        compact ? "py-1.5 pl-4 pr-2" : "py-3 pl-4 pr-3",
        completed && "opacity-60",
        className,
      )}
    >
      <div className={cn("min-w-0 flex-1", compact && "flex items-baseline gap-2")}>
        <div
          className={cn(
            "truncate",
            compact ? "text-subhead font-semibold" : "text-headline",
            completed && "line-through",
          )}
        >
          {title}
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 text-footnote text-secondary-label",
            !compact && "mt-0.5",
          )}
        >
          {!compact && <Icon aria-hidden size={12} />}
          <span>{timeLabel}</span>
          <span className="sr-only">{kind === "event" ? "(fixed event)" : "(auto-planned)"}</span>
        </div>
      </div>
      {completed && (
        <motion.span
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={fluid}
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-success text-white",
            compact ? "size-5" : "size-6",
          )}
        >
          <Check aria-label="Completed" size={compact ? 12 : 14} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}
