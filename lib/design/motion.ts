import type { Transition, Variants } from "motion/react";

/**
 * ONE MOTION FEEL FOR THE WHOLE APP
 * =================================
 *
 * Every animation in the app uses the same spring, `fluid`. There are no
 * per-component speed settings to tweak: one physical "material" makes the
 * app feel like a single liquid surface instead of a pile of widgets that
 * each move differently.
 *
 * Why a spring instead of a duration + easing curve?
 * A classic animation says "go from A to B in 300ms". If you interrupt it
 * (tap again, flick a sheet), the next one starts from a standstill, which
 * looks robotic. A spring is physics: it has position AND velocity, so an
 * interrupted animation keeps its momentum. That is the iOS feel.
 *
 * Motion describes a spring with two human-friendly numbers:
 *   - visualDuration: roughly how long until it *looks* settled (seconds)
 *   - bounce: 0 = no overshoot, 0.5 = very springy
 *
 * A unit test (tests/unit/motion.test.ts) checks this stays a spring.
 */
export const fluid = {
  type: "spring",
  visualDuration: 0.45,
  bounce: 0.22,
} as const satisfies Transition;

/** Used instead of the spring when the user has Reduce Motion turned on. */
export const instant: Transition = { duration: 0 };

/**
 * Pick the right transition for the user's accessibility setting.
 *
 * <MotionConfig reducedMotion="user"> (components/providers.tsx) already
 * removes movement everywhere; this helper is for the rare case where we want
 * to skip even an opacity fade.
 */
export function transitionFor(reduceMotion: boolean | null): Transition {
  return reduceMotion ? instant : fluid;
}

/** How far things shrink while pressed. Subtle reads as "squishy glass". */
export const PRESS_SCALE = 0.96;

/* ---------------------------------------------------------------------------
 * VARIANTS: named animation states components switch between.
 * `initial` → `animate` on mount, `exit` on unmount (inside <AnimatePresence>).
 * All of them use `fluid`.
 * ------------------------------------------------------------------------- */

/** Content that rises slightly as it fades in: cards, sections. */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: fluid },
  exit: { opacity: 0, y: -8, transition: fluid },
};

/** Things that "pop" into place: badges, toasts, empty-state icons. */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: fluid },
  exit: { opacity: 0, scale: 0.94, transition: fluid },
};

/** Put on a list container: children animate in one after another. */
export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
