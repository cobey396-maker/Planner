import type { Metadata } from "next";
import { StreaksScreen } from "@/components/screens/streaks-screen";

export const metadata: Metadata = { title: "Streaks" };

export default function StreaksPage() {
  return <StreaksScreen />;
}
