"use client";

import { CalendarDays, Clock, Loader2, Repeat, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { fluid } from "@/lib/design/motion";
import { TASK_COLOR_NAMES, TASK_COLORS, type TaskColor } from "@/lib/design/tokens";
import { MAX_DAYS_AHEAD } from "@/lib/planner/placement";
import { describeRepeat, expandRepeat, WEEKDAY_NAMES, type RepeatRule } from "@/lib/planner/repeat";
import { usePlanner } from "@/lib/planner/store";
import { formatClock, formatDayKey, formatDuration, formatTime } from "@/lib/time";
import { addDays, dayKey, isoWeekday } from "@/lib/tz";
import { MonthCalendar } from "./month-calendar";

const DURATIONS = [15, 30, 60, 90, 120, 180];
/** Every 15 minutes, all day: planning is 24/7. */
const TIMES = Array.from({ length: 96 }, (_, i) => i * 15);
/** How long a repeating task keeps going, in days. */
const REPEAT_LENGTHS = [
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 61, label: "2 months" },
  { days: 91, label: "3 months" },
  { days: 182, label: "6 months" },
];

type When = "one" | "many" | "repeat";
type Often = "daily" | "weekdays" | "weekly" | "custom";

/**
 * ADD A TASK. Name, length, when, and optionally an exact time.
 *
 * "When" has three modes:
 * - One day: the next two weeks as chips, or any date (up to a year out)
 *   from the calendar.
 * - Pick days: tap as many dates as you like on the calendar.
 * - Repeat: every day / weekdays / every week / custom weekdays (e.g. gym
 *   every Mon, Thu and Fri at 5 PM), for 2 weeks up to 6 months.
 *
 * Every mode becomes a list of days; the planner places the task on each
 * one ("Auto" = first open time, from now today or from 8 AM other days).
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
  const { addTask, timeZone, weekStartsOn } = usePlanner();
  const toast = useToast();
  const startDay = initialDay && initialDay >= today ? initialDay : today;
  const maxDay = addDays(today, MAX_DAYS_AHEAD);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [when, setWhen] = useState<When>("one");
  const [day, setDay] = useState(startDay);
  const [showCalendar, setShowCalendar] = useState(false);
  const [picked, setPicked] = useState<string[]>([startDay]);
  const [often, setOften] = useState<Often>("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(startDay)]);
  const [repeatFrom, setRepeatFrom] = useState(startDay);
  const [repeatLength, setRepeatLength] = useState(30);
  const [startMinute, setStartMinute] = useState<number | null>(null);
  const [color, setColor] = useState<TaskColor>("orange");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chipDays = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const oneDay = day >= today ? day : today;
  const rule: RepeatRule =
    often === "daily"
      ? { kind: "daily" }
      : often === "weekdays"
        ? { kind: "weekdays" }
        : { kind: "weekly", weekdays: often === "weekly" ? [isoWeekday(repeatFrom)] : weekdays };
  const repeatUntil = addDays(repeatFrom, repeatLength - 1);
  const dayKeys =
    when === "one" ? [oneDay] : when === "many" ? [...picked].filter((d) => d >= today).sort() : expandRepeat(rule, repeatFrom, repeatUntil);

  const dayLabel = (d: string) =>
    d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : formatDayKey(d, { weekday: "short", month: "short", day: "numeric" });

  async function submit() {
    if (!title.trim()) {
      setError("Give your task a name first.");
      return;
    }
    if (dayKeys.length === 0) {
      setError(when === "many" ? "Tap at least one day on the calendar." : "Pick at least one weekday.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addTask({ title, minutes, color, dayKeys, startMinute });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      toast(result.error);
      return;
    }
    const first = result.blocks[0];
    if (result.blocks.length === 1 && result.skipped.length === 0) {
      const label = first && dayKey(first.startsAt, timeZone) === today ? "today" : formatDayKey(dayKey(first.startsAt, timeZone), { weekday: "short", month: "short", day: "numeric" });
      toast(`Planned for ${label} at ${formatTime(first.startsAt, timeZone)}`);
    } else if (result.skipped.length === 0) {
      toast(`Planned ${result.blocks.length} times`);
    } else {
      const n = result.skipped.length;
      toast(`Planned ${result.blocks.length} of ${dayKeys.length}. ${n} day${n === 1 ? " was" : "s were"} full or already over`);
    }
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

        <div className="flex flex-col gap-3">
          <span className="px-1 text-footnote font-medium text-secondary-label">When?</span>
          <SegmentedControl<When>
            label="When"
            value={when}
            onChange={(w) => {
              setWhen(w);
              setError(null);
            }}
            options={[
              { value: "one", label: "One day" },
              { value: "many", label: "Pick days" },
              { value: "repeat", label: "Repeat" },
            ]}
          />

          {when === "one" && (
            <>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                {chipDays.map((d) => (
                  <Chip key={d} group="day" selected={oneDay === d} onClick={() => setDay(d)}>
                    {dayLabel(d)}
                  </Chip>
                ))}
                {!chipDays.includes(oneDay) && (
                  <Chip group="day" selected onClick={() => setShowCalendar(true)}>
                    {dayLabel(oneDay)}
                  </Chip>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCalendar((v) => !v)}
                className="flex items-center gap-2 self-start px-1 text-subhead font-semibold text-tint"
              >
                <CalendarDays aria-hidden size={17} /> {showCalendar ? "Hide calendar" : "Pick a later date"}
              </button>
              {showCalendar && (
                <MonthCalendar
                  label="Pick a date"
                  from={today}
                  max={maxDay}
                  selected={[oneDay]}
                  onToggle={(d) => setDay(d)}
                  weekStartsOn={weekStartsOn}
                />
              )}
            </>
          )}

          {when === "many" && (
            <>
              <MonthCalendar
                label="Pick days"
                from={today}
                max={maxDay}
                selected={picked}
                onToggle={(d) => setPicked((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                weekStartsOn={weekStartsOn}
              />
              <p className="px-1 text-footnote text-secondary-label">
                {dayKeys.length === 0
                  ? "Tap days to add them."
                  : `${dayKeys.length} day${dayKeys.length === 1 ? "" : "s"}: ${dayKeys.slice(0, 4).map(dayLabel).join(", ")}${dayKeys.length > 4 ? "…" : ""}`}
              </p>
            </>
          )}

          {when === "repeat" && (
            <>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                {(
                  [
                    ["daily", "Every day"],
                    ["weekdays", "Weekdays"],
                    ["weekly", "Every week"],
                    ["custom", "Choose days"],
                  ] as const
                ).map(([value, label]) => (
                  <Chip key={value} group="often" selected={often === value} onClick={() => setOften(value)}>
                    {label}
                  </Chip>
                ))}
              </div>
              {often === "custom" && (
                <div className="flex justify-between gap-1 px-1" role="group" aria-label="Repeat on">
                  {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                    const on = weekdays.includes(wd);
                    return (
                      <button
                        key={wd}
                        type="button"
                        aria-pressed={on}
                        aria-label={WEEKDAY_NAMES[wd - 1]}
                        onClick={() => setWeekdays((prev) => (on ? prev.filter((x) => x !== wd) : [...prev, wd]))}
                        className={`grid size-10 place-items-center rounded-full text-subhead font-semibold transition-colors ${on ? "bg-tint text-on-tint" : "bg-fill text-label"}`}
                      >
                        {WEEKDAY_NAMES[wd - 1].slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="flex items-center gap-3 px-1">
                <span className="w-16 shrink-0 text-subhead text-secondary-label">Starting</span>
                <select
                  aria-label="Starting"
                  value={repeatFrom}
                  onChange={(e) => setRepeatFrom(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl bg-fill px-3 text-body outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => addDays(today, i)).map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 px-1">
                <span className="w-16 shrink-0 text-subhead text-secondary-label">For</span>
                <select
                  aria-label="Repeat for"
                  value={repeatLength}
                  onChange={(e) => setRepeatLength(Number(e.target.value))}
                  className="h-10 min-w-0 flex-1 rounded-xl bg-fill px-3 text-body outline-none"
                >
                  {REPEAT_LENGTHS.map((r) => (
                    <option key={r.days} value={r.days}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="flex items-center gap-1.5 px-1 text-footnote text-secondary-label" data-testid="repeat-summary">
                <Repeat aria-hidden size={14} />
                {dayKeys.length === 0
                  ? "Pick at least one day."
                  : `${dayKeys.length} time${dayKeys.length === 1 ? "" : "s"}, ${describeRepeat(rule)}${
                      startMinute !== null ? ` at ${formatClock(startMinute)}` : ""
                    }, until ${formatDayKey(dayKeys.at(-1)!, { month: "short", day: "numeric" })}`}
              </p>
            </>
          )}
        </div>

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
              <Sparkles aria-hidden size={18} /> {dayKeys.length > 1 ? `Plan it (${dayKeys.length}×)` : "Plan it"}
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
