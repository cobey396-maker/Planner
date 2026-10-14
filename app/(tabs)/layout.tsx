import { TabBar } from "@/components/ui/tab-bar";
import { PlannerProvider } from "@/lib/planner/store";

/**
 * Shared shell for the five main tabs. "(tabs)" in parentheses is a Next.js
 * ROUTE GROUP: it organizes files without adding "/tabs" to the URL, so the
 * pages are still /today, /week, etc.
 *
 * A layout is NOT re-mounted when you navigate between its pages. That gives
 * us two things for free: planner state survives tab switches, and the tab
 * bar's glass lens can animate from one tab to the next.
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlannerProvider>
      {children}
      <TabBar />
    </PlannerProvider>
  );
}
