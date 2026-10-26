"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AddTaskSheet } from "@/components/planner/add-task-sheet";
import { BlockDetailSheet, useBlockDetail } from "@/components/planner/block-detail-sheet";
import { InstallPrompt } from "@/components/planner/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ProgressRing } from "@/components/ui/progress-ring";
import { BlockListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { TaskBlock } from "@/components/ui/task-block";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { usePlanner } from "@/lib/planner/store";
import type { PlannedBlock } from "@/lib/planner/types";
import { formatDayKey, formatDuration, formatTime, formatTimeRange } from "@/lib/time";
import { dayKey, dayRange } from "@/lib/tz";
import { useNow } from "@/lib/use-now";

/**
 * TODAY: only what YOU planned for today, in your time zone. What's
 * happening now, what's next, and the day as a timeline with the free gaps
 * between blocks.
 */
export function TodayScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { blocks, timeZone } = usePlanner();
  const [adding, setAdding] = useState(false);
  const detail = useBlockDetail();

  const addButton = (
    <Button variant="glass" size="icon" aria-label="Add task" onClick={() => setAdding(true)} disabled={!now}>
      <Plus size={22} className="text-tint" />
    </Button>
  );

  if (!now) {
    return (
      <LargeTitlePage title="Today" subtitle={<Skeleton className="h-4 w-36" />} trailing={addButton}>
        <Skeleton className="mb-6 h-28 rounded-card" />
        <BlockListSkeleton rows={3} />
      </LargeTitlePage>
    );
  }

  const nowMs = now.getTime();
  const today = dayKey(nowMs, timeZone);
  const { start, end } = dayRange(today, timeZone);
  const todays = blocks.filter((b) => b.startsAt >= start && b.startsAt < end);
  const doneCount = todays.filter((b) => b.status === "done").length;
  const current = todays.find((b) => b.startsAt <= nowMs && nowMs < b.endsAt && b.status !== "done");
  const next = todays.find((b) => b.startsAt > nowMs && b.status !== "done");

  return (
    <LargeTitlePage
      title="Today"
      subtitle={formatDayKey(today, { weekday: "long", month: "long", day: "numeric" })}
      trailing={addButton}
    >
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <InstallPrompt dismissible />
        {todays.length === 0 ? (
          <motion.div variants={fadeUp}>
            <Card className="flex flex-col items-center px-6 py-12 text-center">
              <motion.span
                aria-hidden
                className="text-6xl"
                initial={{ scale: 0.6, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={fluid}
              >
                😊
              </motion.span>
              <h2 className="mt-4 text-title2">No tasks for today</h2>
              <p className="mt-1 max-w-xs text-subhead text-secondary-label">
                Enjoy the free time, or add something and we&apos;ll find a spot for it.
              </p>
              <Button className="mt-6 rounded-full" onClick={() => setAdding(true)}>
                <Plus aria-hidden size={18} /> Add a task
              </Button>
            </Card>
          </motion.div>
        ) : (
          <>
            <motion.div variants={fadeUp}>
              <Card className="flex items-center gap-4">
                <ProgressRing value={doneCount / todays.length} label="Today's progress">
                  <span className="text-headline">{doneCount}</span>
                </ProgressRing>
                <div className="min-w-0">
                  <div className="text-headline">
                    {doneCount === todays.length ? "Everything done. Legend." : `${doneCount} of ${todays.length} done`}
                  </div>
                  <div className="mt-0.5 text-subhead text-secondary-label">
                    {next ? (
                      <>
                        Next: <span className="text-label">{next.title}</span> at {formatTime(next.startsAt, timeZone)}
                      </>
                    ) : (
                      "Nothing else planned today."
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            <AnimatePresence>
              {current && (
                <motion.div variants={fadeUp} initial="initial" animate="animate" exit="exit">
                  <NowCard block={current} now={nowMs} timeZone={timeZone} />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.section variants={fadeUp}>
              <SectionHeader>Schedule</SectionHeader>
              <ol className="flex flex-col gap-2.5">
                {todays.map((b, i) => {
                  const gap = i > 0 ? Math.round((b.startsAt - todays[i - 1].endsAt) / 60000) : 0;
                  return (
                    <motion.li key={b.id} layout transition={fluid}>
                      {gap >= 30 && (
                        <div className="mb-2.5 ml-[60px] flex items-center gap-2 text-footnote text-tertiary-label">
                          <span className="h-px flex-1 border-t border-dashed border-separator" />
                          Free · {formatDuration(gap)}
                          <span className="h-px flex-1 border-t border-dashed border-separator" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={
                            "w-12 shrink-0 pt-3 text-right text-footnote tabular-nums " +
                            (b.endsAt <= nowMs ? "text-tertiary-label" : "text-secondary-label")
                          }
                        >
                          {formatTime(b.startsAt, timeZone).replace(/\s?[AP]M$/i, "")}
                        </span>
                        <TaskBlock
                          title={b.title}
                          timeLabel={formatTimeRange(b.startsAt, b.endsAt, timeZone)}
                          color={b.color}
                          completed={b.status === "done"}
                          onClick={() => detail.show(b)}
                        />
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            </motion.section>
          </>
        )}
      </motion.div>

      <AddTaskSheet key={today} open={adding} onOpenChange={setAdding} today={today} />
      <BlockDetailSheet {...detail.sheetProps} />
    </LargeTitlePage>
  );
}

/** The block happening right now, with a progress bar. */
function NowCard({ block, now, timeZone }: { block: PlannedBlock; now: number; timeZone: string }) {
  const progress = (now - block.startsAt) / (block.endsAt - block.startsAt);
  return (
    <div
      className="task-block glass-card rounded-card p-4 pl-5"
      style={{ "--block": `var(--task-${block.color})` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-footnote font-semibold uppercase tracking-wide text-secondary-label">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-danger" />
        </span>
        Happening now
      </div>
      <div className="mt-1 text-title3">{block.title}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `var(--task-${block.color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={fluid}
        />
      </div>
      <div className="mt-1.5 text-footnote text-secondary-label">
        {formatDuration(Math.max(1, Math.round((block.endsAt - now) / 60000)))} left · ends {formatTime(block.endsAt, timeZone)}
      </div>
    </div>
  );
}
