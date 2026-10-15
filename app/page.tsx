import type { Metadata } from "next";
import { AuthScreen } from "@/components/screens/auth-screen";

export const metadata: Metadata = { title: "Sign up" };

/** The front door: create an account or sign in. */
export default function Home() {
  return <AuthScreen />;
}
