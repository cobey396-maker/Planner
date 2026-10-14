"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Lock, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { usePlanner } from "@/lib/planner/store";
import type { Block } from "@/lib/planner/types";
import { formatDuration, formatRange, WEEKDAY_SHORT } from "@/lib/time";

/**
 * Task detail: what, when, and the two things you can do with a block today:
 * complete it, or (for tasks only) delete it. Fixed events are managed in
 * Phase 4, and moving blocks by drag arrives in Phase 6.
 */
export function BlockDetailSheet({
  block,
  open,
  onOpenChange,
}: {
  /** Kept after closing so the content doesn't vanish mid-animation. */
  block: Block | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const onClose = () => onOpenChange(false);
  const { completed, toggleComplete, removeBlock } = usePlanner();
  const toast = useToast();
  const done = block ? completed.has(block.id) : false;

  return (
    <Sheet
      open={open && block !== null}
      onOpenChange={onOpenChange}
      title={block?.title ?? ""}
      description={
        block
          ? `${WEEKDAY_SHORT[block.day]} · ${formatRange(block.start, block.end)} · ${formatDuration(block.end - block.start)}`
          : undefined
      }
    >
      {block && (
        <div className="flex flex-col gap-4 pt-1">
          <div
            className="task-block flex items-center gap-3 rounded-block py-3 pl-4 pr-3 text-subhead"
            style={{ "--block": `var(--task-${block.color})` } as React.CSSProperties}
          >
            {block.kind === "event" ? <Lock aria-hidden size={16} /> : <Sparkles aria-hidden size={16} />}
            {block.kind === "event"
              ? "Fixed event. The planner works around it."
              : "Auto-planned. It moves if your day changes."}
          </div>

          <Button
            size="lg"
            variant={done ? "tinted" : "filled"}
            onClick={() => {
              toggleComplete(block.id);
              if (!done) toast("Nice! +10 points");
              onClose();
            }}
          >
            {done ? <Circle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}
            {done ? "Mark as not done" : "Mark complete"}
          </Button>

          {block.kind === "task" && (
            <Button
              size="lg"
              variant="danger"
              onClick={() => {
                removeBlock(block.id);
                toast("Task deleted");
                onClose();
              }}
            >
              <Trash2 aria-hidden size={18} /> Delete task
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** State for "tap a block → open its detail sheet", shared by Today and Week. */
export function useBlockDetail() {
  const [selected, setSelected] = useState<Block | null>(null);
  const [open, setOpen] = useState(false);
  return {
    show: (block: Block) => {
      setSelected(block);
      setOpen(true);
    },
    sheetProps: { block: selected, open, onOpenChange: setOpen },
  };
}
