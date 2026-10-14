"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BlockDetailSheet, useBlockDetail } from "@/components/planner/block-detail-sheet";
import { Card } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskBlock } from "@/components/ui/task-block";
import { cn } from "@/lib/cn";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { blocksForDay, DAY_END, DAY_START, usePlanner } from "@/lib/planner/store";
import type { Block } from "@/lib/planner/types";
import { addDays, formatClock, formatRange, minutesOfDay, mondayIndex, startOfWeek, WEEKDAY_SHORT } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/** Vertical pixels per hour in the day grid. */
const HOUR_PX = 56;

/**
 * WEEK: how loaded each day is (bar chart), a day picker, and the chosen day
 * as a real calendar grid where block height = duration.
 */
export function WeekScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const [picked, setPicked] = useState<number | null>(null);

  if (!now) {
    return (
      <LargeTitlePage title="Week" subtitle={<Skeleton className="h-4 w-28" />}>
        <Skeleton className="mb-5 h-40 rounded-card" />
        <Skeleton className="mb-5 h-16 rounded-full" />
        <Skeleton className="h-96 rounded-card" />
      </LargeTitlePage>
    );
  }

  const today = mondayIndex(now);
  const day = picked ?? today;
  const monday = startOfWeek(now);
  const sunday = addDays(monday, 6);
  const range = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).formatRange(monday, sunday);

  return (
    <LargeTitlePage title="Week" subtitle={range}>
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-5">
        <motion.div variants={fadeUp}>
          <LoadChart selected={day} today={today} onSelect={setPicked} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <DayStrip monday={monday} selected={day} today={today} onSelect={setPicked} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <DayGrid day={day} isToday={day === today} nowMin={minutesOfDay(now)} />
        </motion.div>
      </motion.div>
    </LargeTitlePage>
  );
}

/**
 * Hours planned per day. One series, so one hue (the tint) and no legend:
 * the title names it. Bars are thin with rounded tops anchored to the
 * baseline, the selected day is solid and the rest are softer. Each bar is a
 * button with a full aria-label, so the chart also works without sight.
 */
function LoadChart({
  selected,
  today,
  onSelect,
}: {
  selected: number;
  today: number;
  onSelect: (d: number) => void;
}) {
  const { blocks } = usePlanner();
  const hours = WEEKDAY_SHORT.map((_, d) =>
    blocks.filter((b) => b.day === d).reduce((sum, b) => sum + (b.end - b.start), 0) / 60,
  );
  const max = Math.max(8, ...hours);
  const total = hours.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-headline">Hours planned</h2>
        <span className="text-footnote text-secondary-label">{total.toFixed(1)} h this week</span>
      </div>
      <div className="mt-1 text-title2 tabular-nums">
        {hours[selected].toFixed(1)} h{" "}
        <span className="text-subhead font-normal text-secondary-label">
          on {selected === today ? "today" : WEEKDAY_SHORT[selected]}
        </span>
      </div>
      <div className="mt-3 flex h-24 items-end gap-2">
        {hours.map((h, d) => (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-label={`${WEEKDAY_SHORT[d]}: ${h.toFixed(1)} hours planned`}
            aria-pressed={d === selected}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <motion.span
              className="w-full max-w-7 rounded-t-[4px] rounded-b-[2px]"
              initial={{ height: 0 }}
              animate={{
                height: `${Math.max(4, (h / max) * 100)}%`,
                opacity: d === selected ? 1 : 0.35,
              }}
              transition={fluid}
              style={{ background: "var(--tint)" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 border-t border-separator pt-1.5">
        {WEEKDAY_SHORT.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex-1 text-center text-caption",
              i === selected ? "font-semibold text-label" : "text-secondary-label",
            )}
          >
            {d[0]}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** Mon–Sun with dates; the selected day sits under a sliding glass lens. */
function DayStrip({
  monday,
  selected,
  today,
  onSelect,
}: {
  monday: Date;
  selected: number;
  today: number;
  onSelect: (d: number) => void;
}) {
  return (
    <div className="glass-card flex rounded-full p-1" role="tablist" aria-label="Day">
      {WEEKDAY_SHORT.map((label, d) => {
        const active = d === selected;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(d)}
            className="relative flex h-14 flex-1 flex-col items-center justify-center rounded-full"
          >
            {active && (
              <motion.span
                layoutId="week-day-lens"
                transition={fluid}
                className="absolute inset-0 rounded-full bg-tint shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
              />
            )}
            <span
              className={cn(
                "relative text-caption font-medium",
                active ? "text-on-tint/80" : "text-secondary-label",
              )}
            >
              {label}
            </span>
            <span
              className={cn(
                "relative text-headline tabular-nums",
                active ? "text-on-tint" : d === today ? "text-tint" : "text-label",
              )}
            >
              {addDays(monday, d).getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The chosen day as an hour grid. Switching days slides the grid sideways. */
function DayGrid({ day, isToday, nowMin }: { day: number; isToday: boolean; nowMin: number }) {
  const { blocks, completed } = usePlanner();
  const detail = useBlockDetail();
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);
  const dayBlocks = blocksForDay(blocks, day);
  const y = (min: number) => ((min - DAY_START) / 60) * HOUR_PX;

  return (
    <Card className="relative overflow-hidden p-0">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={day}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={fluid}
          className="relative mx-3 my-4"
          style={{ height: y(DAY_END) }}
        >
          {hours.map((m) => (
            <div key={m} className="absolute inset-x-0 flex items-center gap-2" style={{ top: y(m) - 8 }}>
              <span className="w-11 shrink-0 text-right text-caption text-tertiary-label tabular-nums">
                {formatClock(m).replace(":00", "")}
              </span>
              <span className="h-px flex-1 bg-separator" />
            </div>
          ))}

          {dayBlocks.map((b: Block) => {
            const height = Math.max(26, y(b.end) - y(b.start) - 3);
            return (
              <TaskBlock
                key={b.id}
                title={b.title}
                timeLabel={formatRange(b.start, b.end)}
                color={b.color}
                kind={b.kind}
                completed={completed.has(b.id)}
                compact={height < 54}
                onClick={() => detail.show(b)}
                className="absolute right-0 left-[3.25rem] w-auto"
                style={{ top: y(b.start) + 1, height }}
              />
            );
          })}

          {isToday && nowMin >= DAY_START && nowMin <= DAY_END && (
            <div
              aria-label={`Now, ${formatClock(nowMin)}`}
              className="absolute right-0 left-[2.75rem] z-10 flex items-center"
              style={{ top: y(nowMin) - 4 }}
            >
              <span className="size-2 rounded-full bg-danger" />
              <span className="h-0.5 flex-1 bg-danger" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <BlockDetailSheet {...detail.sheetProps} />
    </Card>
  );
}
