import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, routeFor } from "@/lib/auth/routing";
import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Runs before every page request.
 *
 * 1. Refreshes the Supabase session. Access tokens expire after an hour;
 *    the Supabase client uses the refresh token to get a new one and we copy
 *    the updated cookies onto both the request (for the page about to
 *    render) and the response (for the browser).
 * 2. Asks routeFor() whether this visitor may see this page.
 */
export async function middleware(request: NextRequest) {
  const config = supabaseConfig();
  const path = request.nextUrl.pathname;
  const demo = request.cookies.get(DEMO_COOKIE)?.value === "1";

  if (!config) {
    return NextResponse.next(); // Demo mode: no accounts, nothing to protect.
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Verifies the token (see lib/auth/session.ts) and refreshes it if needed.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;

  const target = routeFor(path, {
    authEnabled: true,
    signedIn: Boolean(claims?.sub),
    onboarded: meta.onboarded === true,
    demo,
  });

  if (target && target !== path) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed session cookies on the redirect too.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Skip static files, images and the installable-app files (manifest,
  // service worker, offline page); run on pages and auth routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|offline|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
