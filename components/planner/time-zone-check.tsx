"use client";

import { Globe } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { saveSettingsAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { usePlanner } from "@/lib/planner/store";

const DISMISSED_KEY = "tz-check-dismissed";

/**
 * If the time zone saved on the account doesn't match this device's (for
 * example an account that ended up on the "UTC" default), offer to switch
 * with one tap. Times are shown in the saved zone, so a wrong one makes the
 * whole schedule look hours off.
 */
export function TimeZoneCheck() {
  const { mode, timeZone } = usePlanner();
  const device = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const dismissedFor = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(DISMISSED_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);

  if (mode !== "remote" || !device || device === timeZone || dismissedFor === device || hidden) return null;

  return (
    <div className="pt-safe mx-auto max-w-2xl px-4">
      <div role="alert" className="glass-card mt-3 flex flex-col gap-3 rounded-card p-4">
        <p className="flex items-start gap-2 text-subhead">
          <Globe aria-hidden size={18} className="mt-0.5 shrink-0 text-tint" />
          <span>
            Your schedule uses <strong>{timeZone.replaceAll("_", " ")}</strong> time, but this device is in{" "}
            <strong>{device.replaceAll("_", " ")}</strong>. Switch so times match your clock?
          </span>
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="plain"
            size="sm"
            onClick={() => {
              try {
                localStorage.setItem(DISMISSED_KEY, device);
              } catch {}
              setHidden(true);
            }}
          >
            Keep {timeZone.split("/").at(-1)?.replaceAll("_", " ")}
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const res = await saveSettingsAction({ timeZone: device }).catch(() => ({ ok: false as const }));
              if (res.ok) window.location.reload();
              else setSaving(false);
            }}
          >
            Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
