"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { friendlyAuthError } from "@/lib/auth/errors";
import { DEMO_COOKIE } from "@/lib/auth/routing";
import {
  fieldErrors,
  newPasswordSchema,
  passwordResetSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/time";

/**
 * AUTH SERVER ACTIONS
 *
 * "use server" functions run only on the server; the browser calls them
 * like normal async functions (Next.js turns each call into a POST). That
 * means: passwords go straight to Supabase from our server, validation runs
 * again here (the browser's checks can be skipped by anyone), and the
 * session lands in an httpOnly cookie JavaScript can't read.
 */

export type AuthResult =
  | { ok: true; next: string }
  | { ok: true; checkEmail: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const NOT_CONFIGURED: AuthResult = { ok: false, error: "Accounts aren't set up on this server yet." };

/** The site's own origin, for links inside emails. */
async function appOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
}

export async function signUpAction(input: {
  name: string;
  email: string;
  password: string;
  timeZone?: string;
}): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { name, email, password } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user() database trigger to create the profile.
      data: { display_name: name, time_zone: isValidTimeZone(input.timeZone) ? input.timeZone : "UTC" },
      emailRedirectTo: `${await appOrigin()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { ok: false, error: friendlyAuthError(error) };

  // With "Confirm email" on (Supabase's default) there's no session until
  // the user clicks the link. Supabase also answers this way for an email
  // that's already registered, so attackers can't use sign-up to discover
  // who has an account.
  if (!data.session) return { ok: true, checkEmail: email };
  return { ok: true, next: "/onboarding" };
}

export async function signInAction(input: { email: string; password: string }): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: friendlyAuthError(error) };
  // The middleware sends people who haven't onboarded to /onboarding.
  return { ok: true, next: "/today" };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}

/**
 * Always reports success, whether or not the email has an account, so the
 * form can't be used to find out who's signed up.
 */
export async function requestPasswordResetAction(input: { email: string }): Promise<AuthResult> {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter your email first.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { ok: false, error: friendlyAuthError(error) };
  }
  return { ok: true, checkEmail: parsed.data.email };
}

export async function updatePasswordAction(input: { password: string }): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true, next: "/today" };
}
