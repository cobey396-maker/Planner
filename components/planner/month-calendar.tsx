"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDayKey } from "@/lib/time";
import { addDays, isoWeekday, startOfWeek } from "@/lib/tz";

/**
 * A month grid for picking dates, from `from` (today) up to `max`.
 * Works for one date (pass one selected day) or many (toggle as you tap).
 * Days are plain "YYYY-MM-DD" keys, so the grid never depends on the
 * browser's own time zone.
 */
export function MonthCalendar({
  from,
  max,
  selected,
  onToggle,
  weekStartsOn,
  label,
}: {
  from: string;
  max: string;
  selected: string[];
  onToggle: (day: string) => void;
  weekStartsOn: 1 | 7;
  label: string;
}) {
  const firstOfMonth = (key: string) => `${key.slice(0, 8)}01`;
  const [month, setMonth] = useState(firstOfMonth(selected[0] ?? from));
  const nextMonth = firstOfMonth(addDays(month, 31));
  const prevMonth = firstOfMonth(addDays(month, -1));

  // Six rows of seven days, starting on the week containing the 1st.
  const gridStart = startOfWeek(month, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const rows = cells.slice(35).every((d) => d.slice(0, 7) !== month.slice(0, 7)) ? cells.slice(0, 35) : cells;
  const headers = cells.slice(0, 7).map((d) => formatDayKey(d, { weekday: "narrow" }));
  const chosen = new Set(selected);

  return (
    <div className="rounded-2xl bg-fill/60 p-3" role="group" aria-label={label}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={prevMonth < firstOfMonth(from)}
          onClick={() => setMonth(prevMonth)}
          className="grid size-9 place-items-center rounded-full text-tint disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-headline">{formatDayKey(month, { month: "long", year: "numeric" })}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={nextMonth > max}
          onClick={() => setMonth(nextMonth)}
          className="grid size-9 place-items-center rounded-full text-tint disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {headers.map((h, i) => (
          <span key={i} aria-hidden className="text-caption text-secondary-label">
            {h}
          </span>
        ))}
        {rows.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const disabled = d < from || d > max;
          const on = chosen.has(d);
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              aria-label={formatDayKey(d, { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => onToggle(d)}
              className={cn(
                "mx-auto grid size-9 place-items-center rounded-full text-subhead tabular-nums transition-colors",
                on ? "bg-tint font-semibold text-on-tint" : "text-label",
                !inMonth && !on && "text-tertiary-label",
                disabled && "opacity-25",
                d === from && !on && "font-semibold text-tint",
                isoWeekday(d) >= 6 && !on && inMonth && !disabled && "text-secondary-label",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
