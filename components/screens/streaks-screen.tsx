"use client";

import { Lock } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { Card, SectionHeader } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import {
  BADGES,
  bestStreak,
  completionDays,
  currentStreak,
  earnedBadges,
  POINTS_PER_BLOCK,
  PURPLE_FLAME_STREAK,
  weekRecap,
  type BadgeCategory,
} from "@/lib/planner/stats";
import { usePlanner } from "@/lib/planner/store";
import { formatDayKey } from "@/lib/time";
import { addDays, dayKey, startOfWeek } from "@/lib/tz";
import { useNow } from "@/lib/use-now";

const CATEGORIES: BadgeCategory[] = ["Getting started", "Streaks", "Big days", "Time of day", "Habits", "Friends"];

/**
 * STREAKS: everything here is computed from your real completed blocks
 * (lib/planner/stats.ts). A new account starts at 0 streak, 0 points, and
 * every badge locked.
 */
export function StreaksScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { blocks, pointsTotal, timeZone, weekStartsOn, hasAcceptedHangout, friends } = usePlanner();

  if (!now) {
    return (
      <LargeTitlePage title="Streaks">
        <Skeleton className="mb-5 h-48 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </LargeTitlePage>
    );
  }

  const nowMs = now.getTime();
  const today = dayKey(nowMs, timeZone);
  const days = completionDays(blocks, timeZone);
  const streak = currentStreak(days, today);
  const best = bestStreak(days);
  const doneToday = days.has(today);
  const purple = streak >= PURPLE_FLAME_STREAK;

  const thisWeek = startOfWeek(today, weekStartsOn);
  const recap = weekRecap(blocks, thisWeek, timeZone, nowMs);
  const lastWeek = weekRecap(blocks, addDays(thisWeek, -7), timeZone, nowMs);
  const earned = earnedBadges(blocks, { timeZone, weekStartsOn, hasAcceptedHangout, friendsCount: friends.length, now: nowMs });
  const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)}%`);

  return (
    <LargeTitlePage title="Streaks" subtitle="Small wins, every day.">
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center py-6 text-center">
            <motion.span
              aria-hidden
              data-testid="flame"
              data-color={purple ? "purple" : streak > 0 ? "orange" : "grey"}
              className="text-5xl transition-[filter] duration-500"
              style={{
                // The flame emoji, recolored with CSS filters: grey at 0,
                // orange while you're on a streak, purple from 10 days.
                filter: purple ? "hue-rotate(250deg) saturate(1.6)" : streak === 0 ? "grayscale(1) opacity(0.5)" : "none",
              }}
              animate={streak > 0 ? { scale: [1, 1.12, 1], rotate: [0, -4, 3, 0] } : { scale: 1 }}
              transition={streak > 0 ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : fluid}
            >
              🔥
            </motion.span>
            <div className="mt-2 text-large-title tabular-nums" data-testid="streak">
              <CountUp value={streak} />
            </div>
            <div className="text-subhead text-secondary-label">day streak</div>
            <div className="mt-1 text-caption text-tertiary-label">
              {purple ? "Purple flame unlocked 💜" : `Best: ${best}`}
            </div>
          </Card>
          <Card className="flex flex-col items-center py-6 text-center">
            <span aria-hidden className={cn("text-5xl", pointsTotal === 0 && "opacity-50 grayscale")}>
              ✨
            </span>
            <div className="mt-2 text-large-title tabular-nums" data-testid="points">
              <CountUp value={pointsTotal} />
            </div>
            <div className="text-subhead text-secondary-label">points</div>
            <div className="mt-1 text-caption text-tertiary-label">{POINTS_PER_BLOCK} per finished block</div>
          </Card>
        </motion.div>

        <motion.p variants={fadeUp} className="glass-card rounded-full px-4 py-2.5 text-center text-subhead">
          {streak === 0
            ? "Finish a block today to start your streak 🔥"
            : doneToday
              ? `You're on fire! ${streak >= PURPLE_FLAME_STREAK ? "" : `${PURPLE_FLAME_STREAK - streak} more days for the purple flame.`}`
              : "Finish one block today to keep your streak alive 🔥"}
        </motion.p>

        <motion.section variants={fadeUp}>
          <SectionHeader>Weekly recap</SectionHeader>
          <Card>
            <div className="flex items-center gap-4">
              <ProgressRing value={recap.rate ?? 0} size={84} stroke={10} color="var(--success)" label="Plan completed this week">
                <span className="text-headline tabular-nums">{pct(recap.rate)}</span>
              </ProgressRing>
              <div>
                <div className="text-title3">
                  {recap.rate === null ? "Nothing due yet this week" : `You hit ${pct(recap.rate)} of your plan`}
                </div>
                <div className="mt-0.5 text-subhead text-secondary-label">
                  {recap.done} of {recap.due} blocks so far · last week {pct(lastWeek.rate)}
                </div>
              </div>
            </div>
            <WeekBars days={recap.days} today={today} />
          </Card>
        </motion.section>

        <motion.section variants={fadeUp}>
          <SectionHeader>
            Badges{" "}
            <span className="font-normal text-secondary-label" data-testid="badge-count">
              {earned.size} of {BADGES.length}
            </span>
          </SectionHeader>
          <div className="flex flex-col gap-5">
            {CATEGORIES.map((category) => (
              <div key={category}>
                <h3 className="mb-2 px-1 text-footnote font-semibold uppercase tracking-wide text-secondary-label">{category}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {BADGES.filter((b) => b.category === category).map((b) => {
                    const has = earned.has(b.id);
                    return (
                      <motion.div
                        key={b.id}
                        data-testid={`badge-${b.id}`}
                        data-earned={has}
                        whileTap={{ scale: 0.95 }}
                        transition={fluid}
                        className={cn(
                          "glass-card relative flex flex-col items-center rounded-card px-2 py-4 text-center",
                          !has && "opacity-50 grayscale",
                        )}
                      >
                        {!has && <Lock aria-hidden size={14} className="absolute right-2.5 top-2.5 text-secondary-label" />}
                        <span aria-hidden className="text-3xl">
                          {b.emoji}
                        </span>
                        <span className="mt-1.5 text-footnote font-semibold">{b.name}</span>
                        <span className="mt-0.5 text-caption text-secondary-label">{b.detail}</span>
                        <span className="sr-only">{has ? "Earned" : "Locked"}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </motion.div>
    </LargeTitlePage>
  );
}

/** Completion per day this week. Days with nothing due show an empty track. */
function WeekBars({ days, today }: { days: { day: string; rate: number | null }[]; today: string }) {
  return (
    <div className="mt-5">
      <div className="flex h-20 items-end gap-2">
        {days.map((d) => (
          <div
            key={d.day}
            role="img"
            aria-label={`${formatDayKey(d.day, { weekday: "long" })}: ${d.rate === null ? "nothing due" : `${Math.round(d.rate * 100)}% done`}`}
            className="flex h-full flex-1 items-end justify-center rounded-t-[4px] bg-fill/60"
          >
            {d.rate !== null && (
              <motion.span
                className="w-full rounded-t-[4px]"
                style={{ background: "var(--success)" }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, d.rate * 100)}%` }}
                transition={fluid}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {days.map((d) => (
          <span
            key={d.day}
            className={cn("flex-1 text-center text-caption", d.day === today ? "font-semibold text-label" : "text-secondary-label")}
          >
            {formatDayKey(d.day, { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Animated number that counts on the app's spring without re-rendering React each frame. */
function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, fluid);
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{rounded}</motion.span>;
}
