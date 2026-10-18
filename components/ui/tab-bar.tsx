"use client";

import { CalendarDays, CalendarRange, Flame, Settings, Sparkles, Users, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { fluid } from "@/lib/design/motion";

export type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The app's main sections. */
export const APP_TABS: TabItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/week", label: "Week", icon: CalendarRange },
  { href: "/streaks", label: "Streaks", icon: Flame },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/helper", label: "Helper", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Floating liquid-glass tab bar.
 *
 * Instead of a bar glued to the bottom edge, it is a capsule hovering above
 * the content (`glass-pill`). Behind the active tab sits a brighter glass
 * "lens". The lens is ONE motion.span with a shared `layoutId`: when you
 * switch tabs, React renders it inside a different <li>, and Motion slides
 * and stretches it there on the app's fluid spring.
 *
 * This component lives in app/(tabs)/layout.tsx, which stays mounted while
 * you move between tabs. That's what lets the lens animate across pages.
 */
export function TabBar({ items = APP_TABS }: { items?: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3"
    >
      <ul className="glass-pill pointer-events-auto mx-auto mb-3 flex max-w-md rounded-full p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                data-tab={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full",
                  "text-[10px] font-semibold transition-colors duration-300",
                  active ? "text-tint" : "text-secondary-label",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-lens"
                    transition={fluid}
                    className="absolute inset-0 rounded-full bg-lens shadow-[inset_0_1px_0_var(--glass-highlight)]"
                  />
                )}
                <motion.span
                  className="relative"
                  whileTap={{ scale: 0.82 }}
                  animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }}
                  transition={fluid}
                >
                  <Icon aria-hidden size={23} strokeWidth={active ? 2.4 : 1.9} />
                </motion.span>
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
