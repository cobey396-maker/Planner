import { cn } from "@/lib/cn";
import type { TaskColor } from "@/lib/design/tokens";

/** Initials on a soft gradient of the person's color. No photos needed. */
export function Avatar({
  name,
  color,
  size = 44,
  className,
}: {
  name: string;
  color: TaskColor;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
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
      {initials}
    </span>
  );
}
