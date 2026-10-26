"use client";

import { motion } from "motion/react";
import { useEntrance } from "@/lib/design/entrance";

/**
 * Unlike a layout, a TEMPLATE is re-mounted on every navigation. That makes
 * it the place for page transitions: each new tab's content fades in,
 * rising a few pixels.
 *
 * Deliberately quick and cheap. Opacity and transform are the only two
 * properties a browser can animate on the GPU without repainting. An earlier
 * version also animated `filter: blur()` and scale over the whole page; on
 * phones and laptop graphics chips that repaints every frame and made tab
 * switches feel sluggish.
 *
 * useEntrance() skips this on the very first load so the server HTML is
 * visible immediately instead of waiting for JavaScript.
 */
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  const entrance = useEntrance();
  return (
    <motion.div
      initial={entrance && { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
