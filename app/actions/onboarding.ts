"use server";

import { friendlyAuthError } from "@/lib/auth/errors";
import { cookies } from "next/headers";
import type { z } from "zod";
import { PENDING_INVITE_COOKIE } from "@/lib/auth/routing";
import { fieldErrors, onboardingSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";
import type { AuthResult } from "./auth";
import { requestFriendByCodeAction } from "./planner";

/**
 * Save onboarding answers, then mark the account as onboarded.
 * Writes go through Supabase with the user's own token, so row-level
 * security guarantees they only touch their own profile and settings.
 */
export async function saveOnboardingAction(input: z.input<typeof onboardingSchema>): Promise<AuthResult> {
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
  const profile = await supabase
    .from("profiles")
    .update({ display_name: v.displayName, city: v.city, region: v.region })
    .eq("id", userId);
  if (profile.error) return { ok: false, error: "Couldn't save your profile. Please try again." };

  // Planning is 24/7 for everyone.
  const settings = await supabase
    .from("user_settings")
    .update({ time_zone: v.timeZone, day_start_minute: 0, day_end_minute: 1440 })
    .eq("user_id", userId);
  if (settings.error) return { ok: false, error: "Couldn't save your time zone. Please try again." };

  // The "onboarded" flag lives in the user's metadata, which is inside the
  // login token, so the middleware can check it without a database query.
  const updated = await supabase.auth.updateUser({ data: { onboarded: true, display_name: v.displayName } });
  if (updated.error) return { ok: false, error: friendlyAuthError(updated.error) };

  // The current token still says onboarded: false. Refresh it now so the
  // middleware sees the new value, instead of bouncing back to onboarding.
  await supabase.auth.refreshSession();

  // Signed up from a friend's invite link (/add/<code>)? Send that request now.
  const jar = await cookies();
  const invite = jar.get(PENDING_INVITE_COOKIE)?.value;
  if (invite) {
    jar.delete(PENDING_INVITE_COOKIE);
    await requestFriendByCodeAction(invite);
  }
  return { ok: true, next: "/today" };
}
