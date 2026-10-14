"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, as React state that refreshes every 30 seconds.
 *
 * On the server it is `null`. Why? The server renders HTML ahead of time
 * (maybe in a different time zone, maybe hours earlier at build time). If it
 * baked "9:41 AM" into the page and the browser then rendered "3:12 PM", React
 * would complain about a hydration mismatch. So time-dependent UI shows a
 * loading skeleton on the server and fills in once it is running in the browser.
 */
let now: Date | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      now = new Date();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): Date {
  // Must return the SAME object until it really changes, or React re-renders forever.
  if (!now) now = new Date();
  return now;
}

const getServerSnapshot = (): Date | null => null;

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
