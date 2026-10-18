"use server";

import { z } from "zod";
import { fieldErrors, profileSchema } from "@/lib/auth/schema";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/time";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function signedIn() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}
const SESSION_EXPIRED = { ok: false as const, error: "Your session expired. Please sign in again." };

export async function updateProfileAction(input: z.input<typeof profileSchema>): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check your answers.", fieldErrors: fieldErrors(parsed.error) };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const v = parsed.data;
  const row: Record<string, unknown> = { display_name: v.displayName, city: v.city, region: v.region };
  if (v.username) row.handle = v.username;
  const { error } = await session.supabase.from("profiles").update(row).eq("id", session.userId);
  if (error?.code === "23505") return { ok: false, error: "That username is taken.", fieldErrors: { username: "That username is taken" } };
  if (error?.code === "23514") return { ok: false, error: "That username isn't allowed.", fieldErrors: { username: "Try another username" } };
  if (error) return { ok: false, error: "Couldn't save your profile." };
  await session.supabase.auth.updateUser({ data: { display_name: v.displayName } });
  await session.supabase.auth.refreshSession();
  return { ok: true };
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 1024 * 1024;

/**
 * Profile photo upload. The browser already shrank it to a 256px square
 * (components/ui/avatar-picker.tsx); here we check it again (type, size)
 * and store it at avatars/<user id>/avatar.jpg. The storage policy only lets
 * a user write inside their own folder.
 */
export async function uploadAvatarAction(form: FormData): Promise<Result<{ url: string }>> {
  const file = form.get("file");
  if (!(file instanceof Blob)) return { ok: false, error: "Choose a photo first." };
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That photo is too big (1 MB max)." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;

  const path = `${session.userId}/avatar.jpg`;
  const bucket = session.supabase.storage.from("avatars");
  const { error } = await bucket.upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { ok: false, error: "Couldn't upload the photo. Please try again." };

  // ?v= busts browser caches so the new photo shows up immediately.
  const url = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const saved = await session.supabase.from("profiles").update({ avatar_url: url }).eq("id", session.userId);
  if (saved.error) return { ok: false, error: "Couldn't save the photo." };
  return { ok: true, url };
}

export async function removeAvatarAction(): Promise<Result> {
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  await session.supabase.storage.from("avatars").remove([`${session.userId}/avatar.jpg`]);
  const { error } = await session.supabase.from("profiles").update({ avatar_url: null }).eq("id", session.userId);
  return error ? { ok: false, error: "Couldn't remove the photo." } : { ok: true };
}

const settingsSchema = z
  .object({
    notifyUpcoming: z.boolean(),
    notifyMissed: z.boolean(),
    notifyFriends: z.boolean(),
    reminderLeadMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
    weekStartsOn: z.union([z.literal(1), z.literal(7)]),
    timeZone: z.string().refine(isValidTimeZone, "Unknown time zone"),
    discoverable: z.boolean(),
  })
  .partial();

export async function saveSettingsAction(input: z.infer<typeof settingsSchema>): Promise<Result> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting." };
  const session = await signedIn();
  if (!session) return SESSION_EXPIRED;
  const v = parsed.data;
  const row: Record<string, unknown> = {};
  if (v.notifyUpcoming !== undefined) row.notify_upcoming = v.notifyUpcoming;
  if (v.notifyMissed !== undefined) row.notify_missed = v.notifyMissed;
  if (v.notifyFriends !== undefined) row.notify_friends = v.notifyFriends;
  if (v.reminderLeadMinutes !== undefined) row.reminder_lead_minutes = v.reminderLeadMinutes;
  if (v.weekStartsOn !== undefined) row.week_starts_on = v.weekStartsOn;
  if (v.discoverable !== undefined) row.discoverable = v.discoverable;
  if (v.timeZone !== undefined) row.time_zone = v.timeZone;
  if (Object.keys(row).length === 0) return { ok: true };
  const { error } = await session.supabase.from("user_settings").update(row).eq("user_id", session.userId);
  return error ? { ok: false, error: "Couldn't save that setting." } : { ok: true };
}

/** The tab tour has been seen (stored in the account so it never repeats). */
export async function completeTourAction(): Promise<Result> {
  const session = await signedIn();
  if (!session) return { ok: true }; // Demo mode remembers it in the browser instead.
  await session.supabase.auth.updateUser({ data: { tour_done: true } });
  // The flag is read from the login token, so refresh it (like onboarding does).
  await session.supabase.auth.refreshSession();
  return { ok: true };
}
