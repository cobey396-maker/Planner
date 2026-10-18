"use server";

import { friendlyAuthError } from "@/lib/auth/errors";
import { fieldErrors, onboardingSchema, type OnboardingInput } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";
import type { AuthResult } from "./auth";

/**
 * Save onboarding answers, then mark the account as onboarded.
 *
 * The writes go through Supabase with the user's own token, so row-level
 * security guarantees they can only touch their own profile and settings.
 */
export async function saveOnboardingAction(input: OnboardingInput): Promise<AuthResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your answers.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: true, next: "/today" }; // Demo mode: nothing to save.

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, error: "Your session expired. Please sign in again." };

  const v = parsed.data;
  const profile = await supabase.from("profiles").update({ display_name: v.displayName }).eq("id", userId);
  if (profile.error) return { ok: false, error: "Couldn't save your name. Please try again." };

  const settings = await supabase
    .from("user_settings")
    .update({
      time_zone: v.timeZone,
      day_start_minute: v.dayStartMinute,
      day_end_minute: v.dayEndMinute,
      week_starts_on: v.weekStartsOn,
    })
    .eq("user_id", userId);
  if (settings.error) return { ok: false, error: "Couldn't save your schedule settings. Please try again." };

  // The "onboarded" flag lives in the user's metadata, which is inside the
  // login token, so the middleware can check it without a database query.
  const updated = await supabase.auth.updateUser({ data: { onboarded: true, display_name: v.displayName } });
  if (updated.error) return { ok: false, error: friendlyAuthError(updated.error) };

  // The current token still says onboarded: false. Refresh it now so the
  // middleware sees the new value, instead of bouncing back to onboarding.
  await supabase.auth.refreshSession();
  return { ok: true, next: "/today" };
}
