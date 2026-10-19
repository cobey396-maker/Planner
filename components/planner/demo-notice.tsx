"use client";

import { HardDrive, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { usePlanner } from "@/lib/planner/store";

const KEY = "demo-notice-dismissed";

/**
 * Demo mode means the app isn't connected to a database (the Supabase
 * settings in .env.local are missing), so everything is saved in this
 * browser only. Say so plainly, so "my tasks didn't sync" is never a mystery.
 */
export function DemoNotice() {
  const { mode } = usePlanner();
  const dismissed = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(KEY) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [hidden, setHidden] = useState(false);
  if (mode !== "local" || dismissed || hidden) return null;
  return (
    <div className="pt-safe mx-auto max-w-2xl px-4" data-testid="demo-notice">
      <div className="glass-card mt-3 flex items-start gap-3 rounded-2xl px-4 py-3 text-footnote">
        <HardDrive aria-hidden size={18} className="mt-0.5 shrink-0 text-tint" />
        <p className="flex-1 text-secondary-label">
          <strong className="text-label">Demo mode:</strong> your tasks are saved on this device only. To save them to your
          account on any device, the app needs its Supabase settings in .env.local (see DATABASE.md).
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {}
            setHidden(true);
          }}
          className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-secondary-label"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
