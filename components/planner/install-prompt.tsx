"use client";

import { Download, Share, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { INSTALL_DISMISSED_KEY, installPlatform, type InstallPlatform } from "@/lib/pwa";

/** Chrome's install event (not in TypeScript's DOM types yet). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/* ---------------------------------------------------------------------------
 * The install event fires once, early, possibly before any screen that wants
 * it has rendered. So we catch it at the app root (<PwaSetup/>) and keep it
 * in a tiny external store that <InstallPrompt/> reads.
 * ------------------------------------------------------------------------- */
let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function readPlatform(): InstallPlatform {
  return installPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      installed ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: deferred !== null,
  });
}

/**
 * Registers the service worker (production only: in development it would
 * cache pages while you edit them) and listens for the install event.
 */
export function PwaSetup() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // We show our own button instead of Chrome's mini-bar.
      deferred = e as InstallEvent;
      notify();
    };
    const onInstalled = () => {
      installed = true;
      deferred = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        // A worker left over from testing a production build on this port
        // would serve stale dev files. Remove it.
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      }
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/**
 * Where this device stands on installing, and a function that opens the
 * browser's own install dialog (Android/desktop Chrome only). `install()`
 * resolves to true if the person accepted.
 */
export function useInstall(): { platform: InstallPlatform; install: () => Promise<boolean> } {
  const platform = useSyncExternalStore(subscribe, readPlatform, () => "unsupported" as const);
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") installed = true;
    deferred = null;
    notify();
    return outcome === "accepted";
  };
  return { platform, install };
}

function readDismissed() {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Add Auto-Planner to your home screen."
 *
 * `dismissible` (Today): a card you can close for good.
 * Not dismissible (Settings): always there until the app is installed.
 */
export function InstallPrompt({ dismissible = false }: { dismissible?: boolean }) {
  const { platform, install } = useInstall();
  const dismissedBefore = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [closed, setClosed] = useState(false);

  if (platform === "installed" || platform === "unsupported") return null;
  if (dismissible && (dismissedBefore || closed)) return null;

  return (
    <div className="glass-card flex items-start gap-3 rounded-card p-4" data-testid="install-prompt">
      <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-headline">Add it to your home screen</p>
        {platform === "ios" ? (
          <p className="mt-0.5 text-footnote text-secondary-label">
            Tap <Share aria-label="Share" size={14} className="inline -translate-y-0.5" /> Share, then{" "}
            <strong className="text-label">Add to Home Screen</strong>. It opens full-screen, like a real app.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-footnote text-secondary-label">Opens full-screen, one tap from your home screen.</p>
            <Button size="sm" className="mt-2.5 rounded-full" onClick={install}>
              <Download aria-hidden size={16} /> Install app
            </Button>
          </>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
            } catch {}
            setClosed(true);
          }}
          className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-secondary-label"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
