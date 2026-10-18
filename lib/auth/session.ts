import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Account = {
  id: string;
  email: string;
  displayName: string;
  onboarded: boolean;
};

/**
 * The signed-in user, verified. getClaims() checks the access token's
 * signature (locally with Supabase's public signing keys, or by asking the
 * Auth server), so a forged or edited cookie can't impersonate anyone.
 * Never trust getSession() on the server: it just reads the cookie.
 */
export async function getAccount(): Promise<Account | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    displayName: typeof meta.display_name === "string" && meta.display_name ? meta.display_name : "You",
    onboarded: meta.onboarded === true,
  };
}
