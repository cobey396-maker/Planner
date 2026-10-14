"use client";

import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { fluid } from "@/lib/design/motion";

/**
 * Tiny toast system: `const toast = useToast(); toast("Invite sent")`.
 * A glass capsule drops in from the top (like iOS's Dynamic Island alerts)
 * and leaves after 2.4 seconds. role="status" makes screen readers announce it.
 */
type Toast = { id: number; message: string };

const ToastContext = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string) => {
    const id = nextId.current++;
    // Only one at a time: a new toast replaces the old one.
    setToasts([{ id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={fluid}
              className="glass-pill mt-3 flex items-center gap-2 rounded-full px-4 py-2.5 text-subhead font-semibold"
            >
              <CheckCircle2 aria-hidden size={18} className="text-success" />
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
