import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Where links in Supabase emails land (confirm sign-up, reset password).
 *
 * Two formats are supported:
 *  - ?code=…            PKCE flow (Supabase's default with @supabase/ssr):
 *                       we exchange the one-time code for a session.
 *  - ?token_hash=…&type= the email-template flow: we verify the token.
 * Either way the session is saved in cookies and we redirect to `next`,
 * which safeNext() restricts to paths on this site.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  if (supabase) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : { error: new Error("missing code") };
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/?error=link", url.origin));
}
