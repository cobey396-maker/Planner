/**
 * WHO MAY SEE WHICH PAGE
 *
 * The middleware asks this one pure function where each request should go.
 * Keeping the rules here (no cookies, no network) means every case can be
 * unit-tested in milliseconds; see tests/unit/auth-routing.test.ts.
 */

export type Visitor = {
  /** Supabase is set up on this server (otherwise: demo mode, no accounts). */
  authEnabled: boolean;
  signedIn: boolean;
  /** Finished onboarding (stored in the user's metadata). */
  onboarded: boolean;
  /** Chose "Explore with sample data" (a cookie). */
  demo: boolean;
};

/** The app's main screens. Everything under them needs an account or demo. */
const APP_PREFIXES = ["/today", "/week", "/streaks", "/friends", "/settings"];

export const DEMO_COOKIE = "planner-demo";
/** A friend's invite code, remembered while a new person signs up. */
export const PENDING_INVITE_COOKIE = "pending-invite";

function isAppPath(path: string) {
  return APP_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Returns a path to redirect to, or null to let the request through.
 */
export function routeFor(path: string, v: Visitor): string | null {
  // Demo mode (no Supabase): everything is open, like before Phase 3.
  if (!v.authEnabled) return null;

  if (v.signedIn) {
    // New accounts finish onboarding before using the app.
    if (!v.onboarded && (isAppPath(path) || path === "/")) return "/onboarding";
    // Signed-in people don't need the sign-up screen or onboarding again.
    if (v.onboarded && (path === "/" || path === "/onboarding")) return "/today";
    return null;
  }

  // Signed out.
  if (path === "/onboarding" || path === "/reset-password") return "/";
  if (isAppPath(path) && !v.demo) return "/";
  return null;
}

/**
 * Where to send someone after a login link. Only same-site paths are allowed:
 * otherwise a crafted link like /auth/callback?next=https://evil.example
 * would bounce users to a phishing site right after they signed in
 * (an "open redirect").
 */
export function safeNext(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
