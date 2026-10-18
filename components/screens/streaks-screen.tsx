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
  weekRecap,
  type BadgeCategory,
} from "@/lib/planner/stats";
import { FLAME_FILTERS, isUnlocked, levelProgress, REWARDS, streakBonus, titleName, XP, type FlameStyle } from "@/lib/planner/levels";
import { usePlanner } from "@/lib/planner/store";
import { useToast } from "@/components/ui/toast";
import { formatDayKey } from "@/lib/time";
import { addDays, dayKey, startOfWeek } from "@/lib/tz";
import { useNow } from "@/lib/use-now";

const CATEGORIES: BadgeCategory[] = ["Getting started", "Streaks", "Big days", "Time of day", "Habits", "Friends"];

/**
 * STREAKS: everything here is computed from your real completed blocks
 * (lib/planner/stats.ts) and your XP (lib/planner/levels.ts). A new account
 * starts at 0 streak, level 1 with 0 XP, and every badge locked.
 */
export function StreaksScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { blocks, pointsTotal, timeZone, weekStartsOn, hasAcceptedHangout, friends, flameStyle, title } = usePlanner();

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
  const progress = levelProgress(pointsTotal);

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
            <Flame style={streak > 0 ? (flameStyle as FlameStyle) : null} />
            <div className="mt-2 text-large-title tabular-nums" data-testid="streak">
              <CountUp value={streak} />
            </div>
            <div className="text-subhead text-secondary-label">day streak</div>
            <div className="mt-1 text-caption text-tertiary-label">Best: {best}</div>
          </Card>
          <LevelCard xp={pointsTotal} title={title} />
        </motion.div>

        <motion.p variants={fadeUp} className="glass-card rounded-full px-4 py-2.5 text-center text-subhead">
          {streak === 0
            ? "Finish a block today to start your streak 🔥"
            : doneToday
              ? `You're on fire! Tomorrow's first block earns +${streakBonus(streak + 1)} XP.`
              : `Finish a block today to keep your streak: +${streakBonus(streak + 1)} XP bonus`}
        </motion.p>

        <motion.section variants={fadeUp}>
          <SectionHeader>Reward track</SectionHeader>
          <RewardTrack level={progress.level} best={best} />
        </motion.section>

        <motion.section variants={fadeUp}>
          <SectionHeader>How to earn XP</SectionHeader>
          <div className="glass-card overflow-hidden rounded-card [&>*+*]:border-t [&>*+*]:border-separator">
            {[
              ["✅", "Finish a block", `+${XP.complete} XP`],
              ["🌅", "Finish it before 9 AM", `+${XP.early} XP`],
              ["🔥", "First finish of the day, on a streak", `+${XP.streakPerDay}/day`],
              ["⏰", "A block ends and isn't done", `−${Math.abs(XP.missed)} XP`],
            ].map(([emoji, what, xp]) => (
              <div key={what} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="text-xl">
                  {emoji}
                </span>
                <span className="flex-1 text-subhead">{what}</span>
                <span className={cn("shrink-0 text-subhead font-semibold tabular-nums", xp.startsWith("−") ? "text-danger" : "text-success")}>
                  {xp}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-footnote text-secondary-label">
            Streak bonus tops out at +{XP.streakMax}. Up to {XP.dailyCap} finished blocks a day earn XP. Missing blocks
            never makes you lose a level.
          </p>
        </motion.section>

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

/** The streak flame in your equipped style (grey when there's no streak). */
export function Flame({ style, size = "text-5xl" }: { style: FlameStyle | null; size?: string }) {
  const rainbow = style === "rainbow";
  return (
    <motion.span
      aria-hidden
      data-testid="flame"
      data-color={style ?? "grey"}
      className={cn(size, "inline-block")}
      style={{ filter: style === null ? "grayscale(1) opacity(0.5)" : rainbow ? undefined : FLAME_FILTERS[style] }}
      animate={
        style === null
          ? { scale: 1 }
          : {
              scale: [1, 1.12, 1],
              rotate: [0, -4, 3, 0],
              ...(rainbow ? { filter: ["hue-rotate(0deg) saturate(1.6)", "hue-rotate(360deg) saturate(1.6)"] } : {}),
            }
      }
      transition={style === null ? fluid : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      🔥
    </motion.span>
  );
}

/** Level, title and the progress bar to the next level. */
function LevelCard({ xp, title }: { xp: number; title: string }) {
  const p = levelProgress(xp);
  return (
    <Card className="flex flex-col items-center justify-center py-6 text-center">
      <div className="relative grid size-16 place-items-center">
        <ProgressRing value={p.fraction} size={64} stroke={7} color="var(--tint)" label={`Level ${p.level} progress`}>
          <span className="text-title3 font-bold tabular-nums" data-testid="level">
            {p.level}
          </span>
        </ProgressRing>
      </div>
      <div className="mt-2 text-headline">Level {p.level}</div>
      <div className="text-subhead text-tint">{titleName(title)}</div>
      <div className="mt-1 text-caption tabular-nums text-tertiary-label" data-testid="xp">
        <CountUp value={xp} /> XP · {p.toNext.toLocaleString()} to go
      </div>
    </Card>
  );
}

/** Battle-pass style: every reward, locked until its level. Tap one to equip. */
function RewardTrack({ level, best }: { level: number; best: number }) {
  const toast = useToast();
  const { flameStyle, title, equip } = usePlanner();
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" data-testid="reward-track">
      {REWARDS.map((r) => {
        const unlocked = isUnlocked(r, level, best);
        const equipped = (r.kind === "flame" ? flameStyle : title) === r.id;
        return (
          <motion.button
            key={r.id}
            type="button"
            disabled={!unlocked || equipped}
            whileTap={{ scale: 0.95 }}
            transition={fluid}
            data-testid={`reward-${r.id}`}
            data-unlocked={unlocked}
            aria-label={`${r.name}${unlocked ? (equipped ? ", equipped" : ", tap to equip") : `, unlocks at level ${r.level}`}`}
            onClick={async () => {
              const res = await equip(r.kind, r.id);
              toast(res.ok ? `${r.name} equipped` : res.error);
            }}
            className={cn(
              "glass-card relative flex w-28 shrink-0 flex-col items-center rounded-card px-2 py-3 text-center",
              equipped && "shadow-[0_0_0_2.5px_var(--tint)]",
              !unlocked && "opacity-50 grayscale",
            )}
          >
            <span className="text-caption font-semibold text-secondary-label">
              {r.kind === "flame" && "streak" in r && r.streak ? `Lv ${r.level} or ${r.streak}-day streak` : `Level ${r.level}`}
            </span>
            <span aria-hidden className="my-1.5 text-3xl" style={r.kind === "flame" ? { filter: r.id === "rainbow" ? "saturate(1.6)" : FLAME_FILTERS[r.id] } : undefined}>
              {r.kind === "flame" ? "🔥" : r.emoji}
            </span>
            <span className="text-footnote font-semibold">{r.name}</span>
            <span className="mt-0.5 text-caption text-secondary-label">
              {equipped ? "Equipped" : unlocked ? "Tap to equip" : r.kind === "title" ? "Title" : "Flame"}
            </span>
            {!unlocked && <Lock aria-hidden size={12} className="absolute right-2 top-2 text-secondary-label" />}
          </motion.button>
        );
      })}
    </div>
  );
}
