"use client";

import { useEffect } from "react";

/**
 * Entrance animations vs. server rendering
 * ----------------------------------------
 * An element with `initial={{ opacity: 0 }}` is rendered by the SERVER with
 * opacity 0, then faded in by JavaScript. If JS is slow, the user stares at
 * a blank page. So: on the very first page load, skip entrance animations
 * (content is visible in the HTML immediately). After that, every client-side
 * navigation animates normally.
 *
 *   const entrance = useEntrance();
 *   <motion.div variants={fadeUp} initial={entrance} animate="animate" />
 */
let firstLoad = true;

export function useEntrance(): "initial" | false {
  const value = firstLoad ? false : "initial";
  useEffect(() => {
    firstLoad = false;
  }, []);
  return value;
}
