import type { Metadata } from "next";
import { AuthScreen } from "@/components/screens/auth-screen";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign up" };

/**
 * The front door: create an account or sign in. (Signed-in people never see
 * it: the middleware sends them to /today or /onboarding.)
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthScreen authEnabled={isSupabaseConfigured()} linkError={error === "link"} />;
}
