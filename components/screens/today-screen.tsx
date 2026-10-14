"use client";

import { CalendarCheck2, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AddTaskSheet } from "@/components/planner/add-task-sheet";
import { BlockDetailSheet, useBlockDetail } from "@/components/planner/block-detail-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { LargeTitlePage } from "@/components/ui/large-title-page";
import { ProgressRing } from "@/components/ui/progress-ring";
import { BlockListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { TaskBlock } from "@/components/ui/task-block";
import { useEntrance } from "@/lib/design/entrance";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";
import { blocksForDay, usePlanner } from "@/lib/planner/store";
import type { Block } from "@/lib/planner/types";
import { formatClock, formatDuration, formatRange, minutesOfDay, mondayIndex } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/**
 * TODAY: what's happening now, what's next, and the day as a timeline.
 * Gaps between blocks show as "Free" spacers, which makes the auto-planner's
 * job visible: those are the holes it fills with your tasks.
 */
export function TodayScreen() {
  const entrance = useEntrance();
  const now = useNow();
  const { blocks, completed } = usePlanner();
  const [adding, setAdding] = useState(false);
  const detail = useBlockDetail();

  const addButton = (
    <Button variant="glass" size="icon" aria-label="Add task" onClick={() => setAdding(true)} disabled={!now}>
      <Plus size={22} className="text-tint" />
    </Button>
  );

  // Server render / first paint: we don't know the user's local time yet.
  if (!now) {
    return (
      <LargeTitlePage title="Today" subtitle={<Skeleton className="h-4 w-36" />} trailing={addButton}>
        <Skeleton className="mb-6 h-28 rounded-card" />
        <BlockListSkeleton rows={5} />
      </LargeTitlePage>
    );
  }

  const today = mondayIndex(now);
  const nowMin = minutesOfDay(now);
  const dayBlocks = blocksForDay(blocks, today);
  const doneCount = dayBlocks.filter((b) => completed.has(b.id)).length;
  const current = dayBlocks.find((b) => b.start <= nowMin && nowMin < b.end);
  const next = dayBlocks.find((b) => b.start > nowMin);
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <LargeTitlePage title="Today" subtitle={dateLabel} trailing={addButton}>
      <motion.div variants={stagger} initial={entrance} animate="animate" className="flex flex-col gap-6">
        <motion.div variants={fadeUp}>
          <Card className="flex items-center gap-4">
            <ProgressRing value={dayBlocks.length ? doneCount / dayBlocks.length : 0} label="Today's progress">
              <span className="text-headline">{doneCount}</span>
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-headline">
                {doneCount === dayBlocks.length && dayBlocks.length > 0
                  ? "Everything done. Legend."
                  : `${doneCount} of ${dayBlocks.length} done`}
              </div>
              <div className="mt-0.5 text-subhead text-secondary-label">
                {next ? (
                  <>
                    Next: <span className="text-label">{next.title}</span> at {formatClock(next.start)}
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
            <motion.div variants={fadeUp} initial={entrance} animate="animate" exit="exit">
              <NowCard block={current} nowMin={nowMin} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section variants={fadeUp}>
          <SectionHeader>Schedule</SectionHeader>
          {dayBlocks.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarCheck2 className="text-secondary-label" />}
                title="A wide-open day"
                message="Add a task and it'll be slotted into the best free time."
                action={<Button onClick={() => setAdding(true)}>Add a task</Button>}
              />
            </Card>
          ) : (
            <Timeline
              blocks={dayBlocks}
              completed={completed}
              nowMin={nowMin}
              onOpen={detail.show}
            />
          )}
        </motion.section>
      </motion.div>

      <AddTaskSheet open={adding} onOpenChange={setAdding} today={today} nowMinutes={nowMin} />
      <BlockDetailSheet {...detail.sheetProps} />
    </LargeTitlePage>
  );
}

/** The block happening right now, with a liquid progress bar. */
function NowCard({ block, nowMin }: { block: Block; nowMin: number }) {
  const progress = (nowMin - block.start) / (block.end - block.start);
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
        {formatDuration(block.end - nowMin)} left · ends {formatClock(block.end)}
      </div>
    </div>
  );
}

function Timeline({
  blocks,
  completed,
  nowMin,
  onOpen,
}: {
  blocks: Block[];
  completed: ReadonlySet<string>;
  nowMin: number;
  onOpen: (b: Block) => void;
}) {
  return (
    <ol className="flex flex-col gap-2.5">
      {blocks.map((b, i) => {
        const prev = blocks[i - 1];
        const gap = prev ? b.start - prev.end : 0;
        return (
          <motion.li key={b.id} layout transition={fluid} variants={fadeUp} initial="initial" animate="animate">
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
                  (b.end <= nowMin ? "text-tertiary-label" : "text-secondary-label")
                }
              >
                {formatClock(b.start).replace(/\s?[AP]M$/i, "")}
              </span>
              <TaskBlock
                title={b.title}
                timeLabel={formatRange(b.start, b.end)}
                color={b.color}
                kind={b.kind}
                completed={completed.has(b.id)}
                onClick={() => onOpen(b)}
              />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
