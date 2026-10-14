"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fluid } from "@/lib/design/motion";

/**
 * A selectable pill, used for quick choices (duration, day, activity).
 * Pass the same `group` to every chip in a set: the selected background is a
 * shared-layout "lens" that glides from chip to chip.
 */
export function Chip({
  selected,
  onClick,
  group,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  group: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={fluid}
      className={cn(
        "relative h-9 shrink-0 rounded-full px-3.5 text-subhead font-medium transition-colors duration-300",
        selected ? "text-on-tint" : "bg-fill text-label",
        className,
      )}
    >
      {selected && (
        <motion.span
          layoutId={`chip-${group}`}
          transition={fluid}
          className="absolute inset-0 rounded-full bg-tint shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
        />
      )}
      <span className="relative">{children}</span>
    </motion.button>
  );
}
