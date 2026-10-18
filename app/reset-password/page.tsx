import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordScreen } from "@/components/screens/reset-password-screen";
import { getAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New password" };

/** Reached from the reset email's link, which signs you in first. */
export default async function ResetPasswordPage() {
  if (!(await getAccount())) redirect("/");
  return <ResetPasswordScreen />;
}
