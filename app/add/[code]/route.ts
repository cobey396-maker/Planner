import { NextResponse, type NextRequest } from "next/server";
import { requestFriendByCodeAction } from "@/app/actions/planner";
import { PENDING_INVITE_COOKIE } from "@/lib/auth/routing";
import { getAccount } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * A friend's invite link: /add/<code>.
 *
 * - Signed in and set up: send the friend request now, then open Friends.
 * - Otherwise: remember the code in a short-lived cookie and send them to
 *   sign up. Onboarding sends the request once their account exists
 *   (app/actions/onboarding.ts).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!/^[a-f0-9]{12}$/.test(code) || !isSupabaseConfigured()) return to("/friends");

  const account = await getAccount();
  if (account?.onboarded) {
    const result = await requestFriendByCodeAction(code);
    return to(result.ok ? "/friends?invite=sent" : "/friends?invite=invalid");
  }

  const response = to(account ? "/onboarding" : "/");
  response.cookies.set(PENDING_INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24, // a day to finish signing up
  });
  return response;
}
