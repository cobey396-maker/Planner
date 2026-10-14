import type { Metadata } from "next";
import { WeekScreen } from "@/components/screens/week-screen";

export const metadata: Metadata = { title: "Week" };

export default function WeekPage() {
  return <WeekScreen />;
}
