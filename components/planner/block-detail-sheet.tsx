"use client";

import { CheckCircle2, Circle, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { usePlanner } from "@/lib/planner/store";
import type { PlannedBlock } from "@/lib/planner/types";
import { formatDayKey, formatDuration, formatTimeRange } from "@/lib/time";
import { dayKey } from "@/lib/tz";

/** Task detail: when it is, mark it done (or undo), or delete it. */
export function BlockDetailSheet({
  blockId,
  open,
  onOpenChange,
}: {
  /** Kept after closing so the content doesn't vanish mid-animation. */
  blockId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { blocks, setDone, deleteTask, timeZone } = usePlanner();
  const toast = useToast();
  // Remember the last block shown, so the sheet can animate closed after a delete.
  const live = blocks.find((b) => b.id === blockId) ?? null;
  const lastShown = useRef<PlannedBlock | null>(null);
  if (live) lastShown.current = live;
  const block = live ?? lastShown.current;
  const done = block?.status === "done";
  const close = () => onOpenChange(false);

  return (
    <Sheet
      open={open && block !== null}
      onOpenChange={onOpenChange}
      title={block?.title ?? ""}
      description={
        block
          ? `${formatDayKey(dayKey(block.startsAt, timeZone), { weekday: "long", month: "short", day: "numeric" })} · ${formatTimeRange(block.startsAt, block.endsAt, timeZone)} · ${formatDuration(Math.round((block.endsAt - block.startsAt) / 60000))}`
          : undefined
      }
    >
      {block && (
        <div className="flex flex-col gap-4 pt-1">
          <div
            className="task-block flex items-center gap-3 rounded-block py-3 pl-4 pr-3 text-subhead"
            style={{ "--block": `var(--task-${block.color})` } as React.CSSProperties}
          >
            <Sparkles aria-hidden size={16} />
            {done ? "Done. Nice work!" : "Planned for you. Finish it to grow your streak."}
          </div>

          <Button
            size="lg"
            variant={done ? "tinted" : "filled"}
            onClick={async () => {
              close();
              const result = await setDone(block.id, !done);
              if (!result.ok) toast(result.error);
              else if (!done) toast("Nice! +10 points");
            }}
          >
            {done ? <Circle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}
            {done ? "Mark as not done" : "Mark complete"}
          </Button>

          <Button
            size="lg"
            variant="danger"
            onClick={async () => {
              close();
              const result = await deleteTask(block.taskId);
              toast(result.ok ? "Task deleted" : result.error);
            }}
          >
            <Trash2 aria-hidden size={18} /> Delete task
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** State for "tap a block → open its detail sheet", shared by Today and Week. */
export function useBlockDetail() {
  const [blockId, setBlockId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return {
    show: (block: PlannedBlock) => {
      setBlockId(block.id);
      setOpen(true);
    },
    sheetProps: { blockId, open, onOpenChange: setOpen },
  };
}
