"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TaskColor } from "@/lib/design/tokens";

/** "Cobey DeLapp" → "CD", "maya" → "M". */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * A profile picture: the person's photo if they added one, otherwise their
 * initials on a soft gradient of their color. If the photo fails to load
 * (deleted, offline), it falls back to the initials automatically.
 */
export function Avatar({
  name,
  color,
  src,
  size = 44,
  className,
}: {
  name: string;
  color: TaskColor;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = src && broken !== src;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(145deg, color-mix(in srgb, var(--task-${color}) 70%, white), var(--task-${color}))`,
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny user photo from Supabase Storage
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" onError={() => setBroken(src)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
