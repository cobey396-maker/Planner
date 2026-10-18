import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/components/screens/onboarding-screen";
import { getAccount } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const account = await getAccount();
  // The middleware already guards this page; checking again here is cheap
  // defense in depth (pages shouldn't assume middleware ran).
  if (isSupabaseConfigured() && !account) redirect("/");
  return <OnboardingScreen defaultName={account?.displayName ?? ""} remote={account !== null} />;
}
