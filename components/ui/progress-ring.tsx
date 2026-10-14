"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { fluid } from "@/lib/design/motion";

/**
 * A circular progress ring (like Apple's Activity rings).
 *
 * SVG trick: Motion can animate `pathLength` from 0 to 1 on any SVG shape,
 * which "draws" the stroke. We rotate the circle -90° so it starts at 12
 * o'clock, and round the stroke ends for a soft, liquid look.
 */
export function ProgressRing({
  value,
  size = 72,
  stroke = 9,
  color = "var(--tint)",
  label,
  children,
}: {
  /** 0 to 1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(clamped * 100)}%`}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped === 0 ? 0.0001 : clamped }}
          transition={fluid}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
