"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { Card, SectionHeader } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { MOCK_HISTORY } from "@/lib/planner/mock";
import { usePlanner } from "@/lib/planner/store";
import { mondayIndex, WEEKDAY_SHORT } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/** Points per completed block. Phase 8 adds bonuses (on-time, streak days). */
const POINTS_PER_BLOCK = 10;

const BADGES = [
  { emoji: "🌅", name: "Early bird", detail: "Finish a block before 9 AM", earned: true },
  { emoji: "🔥", name: "On fire", detail: "7-day streak", earned: true },
  { emoji: "🧠", name: "Deep work", detail: "3 hours of tasks in a day", earned: true },
  { emoji: "💯", name: "Perfect week", detail: "100% of your plan", earned: false },
  { emoji: "🤝", name: "Study buddy", detail: "Hang out in shared free time", earned: false },
  { emoji: "🏆", name: "Legend", detail: "30-day streak", earned: false },
];

/**
 * STREAKS: the motivation layer. A streak counts days where you finished at
 * least one block; points reward every completion; the weekly recap tells you
 * how much of your plan you actually did.
 */
export function StreaksScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { blocks, completed } = usePlanner();

  if (!now) {
    return (
      <LargeTitlePage title="Streaks">
        <Skeleton className="mb-5 h-48 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </LargeTitlePage>
    );
  }

  const today = mondayIndex(now);
  // This week so far: share of each day's blocks you've completed.
  const thisWeek = WEEKDAY_SHORT.map((_, d) => {
    const day = blocks.filter((b) => b.day === d);
    if (d > today || day.length === 0) return null;
    return day.filter((b) => completed.has(b.id)).length / day.length;
  });
  const planned = blocks.filter((b) => b.day <= today);
  const weekRate = planned.length ? planned.filter((b) => completed.has(b.id)).length / planned.length : 0;
  const lastWeekRate = MOCK_HISTORY.lastWeek.reduce((a, b) => a + b, 0) / 7;
  const doneToday = blocks.some((b) => b.day === today && completed.has(b.id));
  const streak = MOCK_HISTORY.streakDays + (doneToday ? 1 : 0);
  const points = MOCK_HISTORY.points + completed.size * POINTS_PER_BLOCK;

  return (
    <LargeTitlePage title="Streaks" subtitle="Small wins, every day.">
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center py-6 text-center">
            <motion.span
              aria-hidden
              className="text-5xl"
              animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              🔥
            </motion.span>
            <div className="mt-2 text-large-title tabular-nums">
              <CountUp value={streak} />
            </div>
            <div className="text-subhead text-secondary-label">day streak</div>
            <div className="mt-1 text-caption text-tertiary-label">Best: {MOCK_HISTORY.bestStreak}</div>
          </Card>
          <Card className="flex flex-col items-center py-6 text-center">
            <span aria-hidden className="text-5xl">
              ✨
            </span>
            <div className="mt-2 text-large-title tabular-nums">
              <CountUp value={points} />
            </div>
            <div className="text-subhead text-secondary-label">points</div>
            <div className="mt-1 text-caption text-tertiary-label">
              {POINTS_PER_BLOCK} per finished block
            </div>
          </Card>
        </motion.div>

        {!doneToday && (
          <motion.p variants={fadeUp} className="glass-card rounded-full px-4 py-2.5 text-center text-subhead">
            Finish one block today to keep your streak alive 🔥
          </motion.p>
        )}

        <motion.section variants={fadeUp}>
          <SectionHeader>Weekly recap</SectionHeader>
          <Card>
            <div className="flex items-center gap-4">
              <ProgressRing value={weekRate} size={84} stroke={10} color="var(--success)" label="Plan completed this week">
                <span className="text-headline tabular-nums">{Math.round(weekRate * 100)}%</span>
              </ProgressRing>
              <div>
                <div className="text-title3">You hit {Math.round(weekRate * 100)}% of your plan</div>
                <div className="mt-0.5 text-subhead text-secondary-label">
                  so far this week · last week {Math.round(lastWeekRate * 100)}%
                </div>
              </div>
            </div>
            <WeekBars values={thisWeek} today={today} />
          </Card>
        </motion.section>

        <motion.section variants={fadeUp}>
          <SectionHeader>Badges</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            {BADGES.map((b) => (
              <motion.div
                key={b.name}
                whileTap={{ scale: 0.95 }}
                transition={fluid}
                className={cn(
                  "glass-card flex flex-col items-center rounded-card px-2 py-4 text-center",
                  !b.earned && "opacity-45 grayscale",
                )}
              >
                <span aria-hidden className="text-3xl">
                  {b.emoji}
                </span>
                <span className="mt-1.5 text-footnote font-semibold">{b.name}</span>
                <span className="mt-0.5 text-caption text-secondary-label">{b.detail}</span>
                <span className="sr-only">{b.earned ? "Earned" : "Not earned yet"}</span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </motion.div>
    </LargeTitlePage>
  );
}

/**
 * Completion per day this week. One series → one hue, no legend. Days still
 * ahead are drawn as an empty track (null = no data yet, not 0%).
 */
function WeekBars({ values, today }: { values: (number | null)[]; today: number }) {
  return (
    <div className="mt-5">
      <div className="flex h-20 items-end gap-2">
        {values.map((v, d) => (
          <div
            key={d}
            role="img"
            aria-label={`${WEEKDAY_SHORT[d]}: ${v === null ? "no data yet" : `${Math.round(v * 100)}% done`}`}
            className="flex h-full flex-1 items-end justify-center rounded-t-[4px] bg-fill/60"
          >
            {v !== null && (
              <motion.span
                className="w-full rounded-t-[4px]"
                style={{ background: "var(--success)" }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, v * 100)}%` }}
                transition={fluid}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {WEEKDAY_SHORT.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex-1 text-center text-caption",
              i === today ? "font-semibold text-label" : "text-secondary-label",
            )}
          >
            {d[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Animated number. A Motion "motion value" counts toward the target on the
 * app's spring, and we render it through useTransform, so the count-up never
 * re-renders React on every frame.
 */
function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, fluid);
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{rounded}</motion.span>;
}
