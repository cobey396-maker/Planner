"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AddTaskSheet } from "@/components/planner/add-task-sheet";
import { BlockDetailSheet, useBlockDetail } from "@/components/planner/block-detail-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskBlock } from "@/components/ui/task-block";
import { cn } from "@/lib/cn";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { usePlanner } from "@/lib/planner/store";
import type { PlannedBlock } from "@/lib/planner/types";
import { formatClock, formatDayKey, formatDuration, formatTimeRange } from "@/lib/time";
import { addDays, dayKey, dayRange, startOfWeek } from "@/lib/tz";
import { useNow } from "@/lib/use-now";

/** Vertical pixels per hour in the 24-hour day grid. */
const HOUR_PX = 48;

/** Hours planned per day of a week: the SAME blocks the grid draws, so they always agree. */
export function hoursByDay(blocks: PlannedBlock[], weekDays: string[], timeZone: string): number[] {
  return weekDays.map((day) => {
    const { start, end } = dayRange(day, timeZone);
    const minutes = blocks
      .filter((b) => b.startsAt >= start && b.startsAt < end && b.status !== "skipped")
      .reduce((sum, b) => sum + (b.endsAt - b.startsAt) / 60000, 0);
    return minutes / 60;
  });
}

/**
 * WEEK: a real calendar week (Mon–Sun or Sun–Sat, from your settings) in
 * your time zone. Step to other weeks, see hours planned per day, pick a day
 * to see it as a 24-hour grid, and add tasks with +.
 */
export function WeekScreen() {
  const now = useNow();
  const { blocks, timeZone, weekStartsOn } = usePlanner();
  const [weekOffset, setWeekOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const detail = useBlockDetail();

  const addButton = (
    <Button variant="glass" size="icon" aria-label="Add task" onClick={() => setAdding(true)} disabled={!now}>
      <Plus size={22} className="text-tint" />
    </Button>
  );

  if (!now) {
    return (
      <LargeTitlePage title="Week" subtitle={<Skeleton className="h-4 w-28" />} trailing={addButton}>
        <Skeleton className="mb-5 h-40 rounded-card" />
        <Skeleton className="mb-5 h-16 rounded-full" />
        <Skeleton className="h-96 rounded-card" />
      </LargeTitlePage>
    );
  }

  const today = dayKey(now.getTime(), timeZone);
  const weekStart = addDays(startOfWeek(today, weekStartsOn), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // The selected day: what you picked (if it's in this week), else today, else the first day.
  const day = picked && weekDays.includes(picked) ? picked : weekDays.includes(today) ? today : weekStart;
  const range = `${formatDayKey(weekStart, { month: "short", day: "numeric" })} – ${formatDayKey(weekDays[6], { month: "short", day: "numeric" })}`;

  return (
    <LargeTitlePage title="Week" subtitle={range} trailing={addButton}>
      <motion.div variants={stagger} initial={false} animate="animate" className="flex flex-col gap-5">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <Button variant="glass" size="icon" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft size={20} className="text-tint" />
          </Button>
          <button
            type="button"
            onClick={() => {
              setWeekOffset(0);
              setPicked(today);
            }}
            disabled={weekOffset === 0}
            className="text-subhead font-semibold text-tint disabled:text-secondary-label"
          >
            {weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : weekOffset === -1 ? "Last week" : "Back to this week"}
          </button>
          <Button variant="glass" size="icon" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight size={20} className="text-tint" />
          </Button>
        </motion.div>
        <motion.div variants={fadeUp}>
          <LoadChart blocks={blocks} weekDays={weekDays} selected={day} today={today} timeZone={timeZone} onSelect={setPicked} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <DayStrip weekDays={weekDays} selected={day} today={today} onSelect={setPicked} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <DayGrid
            day={day}
            blocks={blocks}
            timeZone={timeZone}
            now={now.getTime()}
            isToday={day === today}
            onOpen={detail.show}
            onAdd={() => setAdding(true)}
          />
        </motion.div>
      </motion.div>
      <AddTaskSheet key={`${today}-${day}`} open={adding} onOpenChange={setAdding} today={today} initialDay={day} />
      <BlockDetailSheet {...detail.sheetProps} />
    </LargeTitlePage>
  );
}

/**
 * Hours planned per day. One series → one hue (the tint), no legend; the
 * title names it. Each bar is a button with a full label for screen readers.
 */
function LoadChart({
  blocks,
  weekDays,
  selected,
  today,
  timeZone,
  onSelect,
}: {
  blocks: PlannedBlock[];
  weekDays: string[];
  selected: string;
  today: string;
  timeZone: string;
  onSelect: (day: string) => void;
}) {
  const hours = hoursByDay(blocks, weekDays, timeZone);
  const max = Math.max(4, ...hours);
  const total = hours.reduce((a, b) => a + b, 0);
  const selectedHours = hours[weekDays.indexOf(selected)] ?? 0;
  const fmt = (h: number) => formatDuration(Math.round(h * 60)).replace(/^0m$/, "0h");

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-headline">Hours planned</h2>
        <span className="text-footnote text-secondary-label">{fmt(total)} this week</span>
      </div>
      <div className="mt-1 text-title2 tabular-nums">
        {fmt(selectedHours)}{" "}
        <span className="text-subhead font-normal text-secondary-label">
          on {selected === today ? "today" : formatDayKey(selected, { weekday: "long" })}
        </span>
      </div>
      <div className="mt-3 flex h-24 items-end gap-2">
        {weekDays.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-label={`${formatDayKey(d, { weekday: "long", month: "short", day: "numeric" })}: ${fmt(hours[i])} planned`}
            aria-pressed={d === selected}
            className="flex h-full flex-1 flex-col items-center justify-end"
          >
            <motion.span
              className="w-full max-w-7 rounded-t-[4px] rounded-b-[2px]"
              initial={false}
              animate={{
                height: hours[i] > 0 ? `${Math.max(6, (hours[i] / max) * 100)}%` : "3px",
                opacity: d === selected ? 1 : 0.35,
              }}
              transition={fluid}
              style={{ background: hours[i] > 0 ? "var(--tint)" : "var(--fill)" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 border-t border-separator pt-1.5">
        {weekDays.map((d) => (
          <span
            key={d}
            className={cn("flex-1 text-center text-caption", d === selected ? "font-semibold text-label" : "text-secondary-label")}
          >
            {formatDayKey(d, { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** The week's days with dates; the selected one sits under a sliding lens. */
function DayStrip({
  weekDays,
  selected,
  today,
  onSelect,
}: {
  weekDays: string[];
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}) {
  return (
    <div className="glass-card flex rounded-full p-1" role="tablist" aria-label="Day">
      {weekDays.map((d) => {
        const active = d === selected;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={formatDayKey(d, { weekday: "long", month: "long", day: "numeric" })}
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
            <span className={cn("relative text-caption font-medium", active ? "text-on-tint/80" : "text-secondary-label")}>
              {formatDayKey(d, { weekday: "short" })}
            </span>
            <span
              className={cn(
                "relative text-headline tabular-nums",
                active ? "text-on-tint" : d === today ? "text-tint" : "text-label",
              )}
            >
              {formatDayKey(d, { day: "numeric" })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The chosen day as a 24-hour grid (planning is 24/7). */
function DayGrid({
  day,
  blocks,
  timeZone,
  now,
  isToday,
  onOpen,
  onAdd,
}: {
  day: string;
  blocks: PlannedBlock[];
  timeZone: string;
  now: number;
  isToday: boolean;
  onOpen: (b: PlannedBlock) => void;
  onAdd: () => void;
}) {
  const { start, end } = dayRange(day, timeZone);
  // Real elapsed minutes from local midnight, so 23/25-hour DST days lay out correctly.
  const y = (ms: number) => ((ms - start) / 3_600_000) * HOUR_PX;
  const hours = Array.from({ length: Math.round((end - start) / 3_600_000) + 1 }, (_, i) => i);
  const dayBlocks = blocks.filter((b) => b.startsAt >= start && b.startsAt < end);
  const scroller = useRef<HTMLDivElement>(null);

  // Open the grid scrolled to the first block (or "now"), not to midnight.
  const focusMs = isToday ? now : (dayBlocks[0]?.startsAt ?? start + 8 * 3_600_000);
  useEffect(() => {
    scroller.current?.scrollTo({ top: Math.max(0, y(focusMs) - 2 * HOUR_PX) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the day changes
  }, [day]);

  return (
    <Card className="relative overflow-hidden p-0">
      {dayBlocks.length === 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-3">
          <span className="text-subhead text-secondary-label">Nothing planned this day.</span>
          <Button size="sm" variant="tinted" className="rounded-full" onClick={onAdd}>
            <Plus aria-hidden size={16} /> Add
          </Button>
        </div>
      )}
      <div ref={scroller} className="max-h-[28rem] overflow-y-auto" data-testid="day-grid">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={day}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={fluid}
            className="relative mx-3 my-4"
            style={{ height: y(end) }}
          >
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 flex items-center gap-2" style={{ top: h * HOUR_PX - 8 }}>
                <span className="w-11 shrink-0 text-right text-caption text-tertiary-label tabular-nums">
                  {formatClock((h % 24) * 60).replace(":00", "")}
                </span>
                <span className="h-px flex-1 bg-separator" />
              </div>
            ))}

            {dayBlocks.map((b) => {
              const height = Math.max(24, y(b.endsAt) - y(b.startsAt) - 3);
              return (
                <TaskBlock
                  key={b.id}
                  title={b.title}
                  timeLabel={formatTimeRange(b.startsAt, b.endsAt, timeZone)}
                  color={b.color}
                  completed={b.status === "done"}
                  compact={height < 50}
                  onClick={() => onOpen(b)}
                  className="absolute right-0 left-[3.25rem] w-auto"
                  style={{ top: y(b.startsAt) + 1, height }}
                />
              );
            })}

            {isToday && now >= start && now < end && (
              <div
                aria-label={`Now, ${formatTimeRange(now, now, timeZone)}`}
                className="absolute right-0 left-[2.75rem] z-10 flex items-center"
                style={{ top: y(now) - 4 }}
              >
                <span className="size-2 rounded-full bg-danger" />
                <span className="h-0.5 flex-1 bg-danger" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}
