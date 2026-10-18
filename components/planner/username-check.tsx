"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { checkUsernameAction } from "@/app/actions/auth";
import { username } from "@/lib/auth/schema";

/** What we know about the username being typed. */
export type UsernameStatus = { state: "idle" | "checking" | "available" | "taken" | "invalid"; message?: string };

/**
 * Checks a username as it's typed: the format right away, then (after a
 * short pause, so we don't ask the server on every keystroke) whether it's
 * free. Only the latest answer counts, even if replies arrive out of order.
 * `unchanged` = it's the user's current username, so no need to ask.
 */
export function useUsernameStatus(value: string, { active = true, unchanged = false } = {}): UsernameStatus {
  const [result, setResult] = useState<{ for: string; status: UsernameStatus } | null>(null);
  const trimmed = value.trim();
  const format = username.safeParse(trimmed);
  const shouldAsk = active && !unchanged && trimmed !== "" && format.success;

  useEffect(() => {
    if (!shouldAsk || !format.success) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const res = await checkUsernameAction(format.data).catch(() => null);
      if (stale) return;
      setResult({
        for: trimmed,
        status: !res ? { state: "idle" } : res.available ? { state: "available" } : { state: "taken", message: res.error },
      });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // format.data is derived from trimmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, shouldAsk]);

  if (!active || trimmed === "") return { state: "idle" };
  if (unchanged) return { state: "available" }; // even a generated "user_…" one
  if (!format.success) return { state: "invalid", message: format.error.issues[0]?.message };
  return result?.for === trimmed ? result.status : { state: "checking" };
}

/** The live "available / taken" line under a username field. */
export function UsernameHint({ status, name, className }: { status: UsernameStatus; name: string; className?: string }) {
  const handle = name.trim().toLowerCase();
  const content =
    status.state === "checking" ? (
      <span className="flex items-center gap-1.5 text-secondary-label">
        <Loader2 aria-hidden size={13} className="animate-spin" /> Checking @{handle}…
      </span>
    ) : status.state === "available" ? (
      <span className="flex items-center gap-1.5 text-success">
        <Check aria-hidden size={14} /> @{handle} is available
      </span>
    ) : status.state === "taken" || status.state === "invalid" ? (
      <span className="flex items-center gap-1.5 text-danger">
        <X aria-hidden size={14} /> {status.message ?? "That username is taken"}
      </span>
    ) : null;
  return (
    <p role="status" aria-live="polite" data-testid="username-status" className={className ?? "px-4 pt-1.5 text-footnote"}>
      {content}
    </p>
  );
}
