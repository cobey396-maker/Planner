import type { Metadata } from "next";
import { OfflineScreen } from "@/components/screens/offline-screen";

export const metadata: Metadata = { title: "Offline" };

// Static, so the service worker can cache it once at install time.
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineScreen />;
}
