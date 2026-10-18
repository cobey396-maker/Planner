import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the SECRET (service role) key. It BYPASSES row-level
 * security, so it's only for trusted server jobs that act on many users (the
 * email job). Never import this from code that handles a user's request data
 * without checking who they are first, and never expose the key to the browser.
 *
 * Returns null when SUPABASE_SECRET_KEY isn't set (emails simply don't send).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
