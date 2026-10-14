"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { fluid } from "@/lib/design/motion";

/**
 * iOS toggle switch. A real <button role="switch"> so keyboards and screen
 * readers work; the thumb slides between flex-start and flex-end, and the
 * `layout` prop turns that jump into a fluid spring.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[31px] w-[51px] shrink-0 rounded-full p-0.5 transition-colors duration-300",
        "disabled:opacity-40",
        checked ? "justify-end bg-success" : "justify-start bg-fill",
      )}
    >
      <motion.span
        layout
        transition={fluid}
        whileTap={{ scaleX: 1.15 }}
        className="size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.18)]"
      />
    </button>
  );
}
