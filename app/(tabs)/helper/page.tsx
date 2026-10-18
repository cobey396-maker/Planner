import type { Metadata } from "next";
import { HelperScreen } from "@/components/screens/helper-screen";
import { getAccount } from "@/lib/auth/session";
import { hasFeature } from "@/lib/plans";

export const metadata: Metadata = { title: "Schedule Helper" };

export default async function HelperPage() {
  const account = await getAccount();
  // Only whether the key exists is sent to the browser, never the key itself.
  return (
    <HelperScreen configured={Boolean(process.env.ANTHROPIC_API_KEY)} allowed={hasFeature("schedule_helper", account)} />
  );
}
