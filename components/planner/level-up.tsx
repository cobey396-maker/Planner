"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fireConfetti } from "@/lib/confetti";
import { fluid } from "@/lib/design/motion";
import { FLAME_FILTERS, rewardsBetween } from "@/lib/planner/levels";
import { usePlanner } from "@/lib/planner/store";

/**
 * LEVEL UP! A full-screen, Fortnite-style moment when your XP crosses into a
 * new level: the number slams in, rewards you just unlocked fly up below it,
 * and confetti goes off. Mounted once in app/(tabs)/layout.tsx.
 */
export function LevelUp() {
  const { levelUp, dismissLevelUp } = usePlanner();

  useEffect(() => {
    if (!levelUp) return;
    fireConfetti(180);
    const timer = setTimeout(() => fireConfetti(120), 600);
    return () => clearTimeout(timer);
  }, [levelUp]);

  const unlocked = levelUp ? rewardsBetween(levelUp.from, levelUp.to) : [];

  return (
    <AnimatePresence>
      {levelUp && (
        <motion.div
          key="level-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-up-title"
          className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fluid}
          onClick={dismissLevelUp}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-[32px] p-7 text-center text-white shadow-2xl"
            style={{ background: "linear-gradient(160deg, #5b2bff 0%, #2f7bff 45%, #00c2ff 100%)" }}
            initial={{ scale: 0.6, rotate: -6, y: 40 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Light rays spinning behind the number. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-24 size-[520px] -translate-x-1/2 -translate-y-1/2 opacity-30"
              style={{ background: "repeating-conic-gradient(from 0deg, #fff 0deg 8deg, transparent 8deg 24deg)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            />
            <motion.p
              className="relative text-footnote font-black uppercase tracking-[0.3em]"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...fluid, delay: 0.15 }}
            >
              Level up!
            </motion.p>
            <motion.div
              id="level-up-title"
              className="relative mt-1 text-[96px] font-black leading-none tabular-nums drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]"
              initial={{ scale: 2.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.25 }}
            >
              {levelUp.to}
            </motion.div>
            <p className="relative mt-1 text-subhead font-semibold opacity-90">You reached level {levelUp.to}</p>

            {unlocked.length > 0 && (
              <div className="relative mt-5 flex flex-col gap-2">
                <p className="text-caption font-bold uppercase tracking-widest opacity-80">Unlocked</p>
                {unlocked.map((r, i) => (
                  <motion.div
                    key={r.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-2.5 text-left"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...fluid, delay: 0.5 + i * 0.12 }}
                  >
                    <span aria-hidden className="text-2xl" style={r.kind === "flame" ? { filter: FLAME_FILTERS[r.id] } : undefined}>
                      {r.kind === "flame" ? "🔥" : r.emoji}
                    </span>
                    <span className="flex-1 text-subhead font-semibold">{r.name}</span>
                    <span className="text-caption opacity-80">{r.kind === "flame" ? "Flame" : "Title"}</span>
                  </motion.div>
                ))}
              </div>
            )}

            <Button className="relative mt-6 w-full rounded-full bg-white text-headline text-[#2f3cff]" onClick={dismissLevelUp}>
              Let&apos;s go!
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Once per visit: "You missed 2 blocks: −100 XP". */
export function MissedNotice() {
  const { missed } = usePlanner();
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (!missed || shown.current) return;
    shown.current = true;
    const timer = setTimeout(
      () =>
        toast(
          missed.xpLost > 0
            ? `You missed ${missed.count} block${missed.count === 1 ? "" : "s"}: −${missed.xpLost} XP`
            : `You missed ${missed.count} block${missed.count === 1 ? "" : "s"} (your level is safe)`,
        ),
      800,
    );
    return () => clearTimeout(timer);
  }, [missed, toast]);
  return null;
}
