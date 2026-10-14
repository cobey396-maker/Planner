"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { fluid } from "@/lib/design/motion";

/**
 * iOS segmented control (e.g. "Day | Week", "System | Light | Dark").
 *
 * The white "thumb" behind the selected option is a single motion.div with a
 * shared `layoutId`. When the selection changes, React renders the thumb
 * inside a different button; Motion notices the same layoutId moved and
 * animates it there on a spring instead of teleporting. This is called a
 * "shared layout animation".
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  // Unique per instance, so two controls on one page don't share a thumb.
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid rounded-full bg-fill p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className="relative h-9 rounded-full text-subhead font-medium"
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={fluid}
                className="absolute inset-0 rounded-full bg-lens shadow-card shadow-[inset_0_1px_0_var(--glass-highlight)]"
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
