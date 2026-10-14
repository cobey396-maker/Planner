"use client";

import { motion } from "motion/react";
import { fluid } from "@/lib/design/motion";
import { useEntrance } from "@/lib/design/entrance";

/**
 * Unlike a layout, a TEMPLATE is re-mounted on every navigation. That makes
 * it the place for page transitions: each new tab's content melts in, rising
 * slightly out of a soft blur, on the app's one fluid spring.
 *
 * useEntrance() skips this on the very first load so the server HTML is
 * visible immediately instead of waiting for JavaScript.
 */
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  const entrance = useEntrance();
  return (
    <motion.div
      initial={entrance && { opacity: 0, y: 10, scale: 0.985, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={fluid}
    >
      {children}
    </motion.div>
  );
}
