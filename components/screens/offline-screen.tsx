"use client";

import { ErrorState } from "@/components/ui/states";

/** Shown by the service worker (public/sw.js) when a page can't load offline. */
export function OfflineScreen() {
  return (
    <main className="grid min-h-dvh place-items-center pt-safe pb-safe">
      <ErrorState
        title="You're offline"
        message="Your schedule will be back as soon as you reconnect."
        onRetry={() => window.location.reload()}
      />
    </main>
  );
}
