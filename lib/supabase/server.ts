import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

/**
 * A Supabase client for Server Components, Server Actions and Route
 * Handlers. It reads the login session from cookies, and writes refreshed
 * cookies back when it can.
 *
 * Every database call it makes carries the user's token, so Postgres
 * row-level security applies exactly as it would in the browser.
 *
 * Returns null in demo mode (Supabase not configured).
 */
export async function createClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. That's fine: the middleware
          // already refreshed the session for this request.
        }
      },
    },
  });
}

export type ServerSupabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;
