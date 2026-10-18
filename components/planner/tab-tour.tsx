"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { completeTourAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { fluid } from "@/lib/design/motion";

/** Demo mode (no account) remembers the tour in this browser instead. */
export const TOUR_KEY = "tour-done";

const STEPS = [
  {
    tab: "/today",
    emoji: "☀️",
    title: "Today",
    body: "Your day at a glance: what's on now, what's next, and the free time in between. Tap a block to mark it done.",
  },
  {
    tab: "/week",
    emoji: "🗓️",
    title: "Week",
    body: "Your whole week, hour by hour. Tap + to add a task and we'll find the first open time for it, or pick the time yourself.",
  },
  {
    tab: "/streaks",
    emoji: "🔥",
    title: "Streaks",
    body: "Finish at least one block a day to grow your streak. Every block is 10 points, and badges unlock as you go. Hit 10 days for the purple flame.",
  },
  {
    tab: "/friends",
    emoji: "👋",
    title: "Friends",
    body: "Add friends with your invite link and find times you're both free. They only ever see that you're busy, never what you're doing.",
  },
  {
    tab: "/helper",
    emoji: "✨",
    title: "Schedule Helper",
    body: "Just say what you need, like \"gym at 5 every Monday, Thursday and Friday\", and it plans it for you. It can also find free time and move things around.",
  },
] as const;

function readLocalDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // Storage blocked: don't nag on every visit.
  }
}

/**
 * A short first-run tour of the four main tabs (Settings explains itself).
 * Each step navigates to its tab, lifts that tab's icon in the tab bar with
 * a glowing ring, and shows a card above the bar. Finishing or skipping
 * saves "tour_done" on the account (or in localStorage for demo mode), so it
 * shows exactly once.
 */
export function TabTour({ accountTourDone }: { accountTourDone: boolean | null }) {
  const router = useRouter();
  const pathname = usePathname();
  // localStorage only exists in the browser; on the server we assume "done"
  // so the tour never flashes in server-rendered HTML.
  const localDone = useSyncExternalStore(
    () => () => {},
    readLocalDone,
    () => true,
  );
  const alreadyDone = accountTourDone ?? localDone;
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const open = !alreadyDone && !closed;
  const current = STEPS[step];

  // Keep the ring on the right tab icon.
  const [ring, setRing] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector(`[data-tab="${current.tab}"]`);
      setRing(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, current.tab, pathname]);

  // Show the tab each step talks about.
  useEffect(() => {
    if (open && pathname !== current.tab) router.push(current.tab);
  }, [open, current.tab, pathname, router]);

  function finish() {
    setClosed(true);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    if (accountTourDone === false) void completeTourAction().catch(() => {});
    router.push("/today");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fluid}
        >
          {/* Dim everything; the tab bar shows through the ring's "hole". */}
          <div className="absolute inset-0 bg-black/45" />
          {ring && (
            <motion.div
              aria-hidden
              className="absolute rounded-full shadow-[0_0_0_3px_var(--tint),0_0_24px_6px_var(--tint)]"
              initial={false}
              animate={{
                left: ring.left + ring.width / 2 - 30,
                top: ring.top + ring.height / 2 - 30,
              }}
              transition={fluid}
              style={{ width: 60, height: 60 }}
            />
          )}

          <div className="pb-safe absolute inset-x-0 bottom-24 mx-auto max-w-md px-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tour-title"
              className="glass-card rounded-card p-5 shadow-float"
              layout
              transition={fluid}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={fluid}
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-4xl">
                      {current.emoji}
                    </span>
                    <div>
                      <div className="text-footnote font-semibold uppercase tracking-wide text-secondary-label">
                        Quick tour · {step + 1} of {STEPS.length}
                      </div>
                      <h2 id="tour-title" className="text-title2">
                        {current.title}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-3 text-body text-secondary-label">{current.body}</p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex flex-1 gap-1.5" aria-hidden>
                  {STEPS.map((s, i) => (
                    <span key={s.tab} className={`h-1.5 w-5 rounded-full ${i <= step ? "bg-tint" : "bg-fill"}`} />
                  ))}
                </div>
                <Button variant="plain" onClick={finish}>
                  Skip
                </Button>
                <Button
                  className="rounded-full px-5"
                  onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
                >
                  {step === STEPS.length - 1 ? "Let's go" : "Next"}
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
