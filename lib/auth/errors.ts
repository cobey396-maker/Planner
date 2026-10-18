/**
 * Turn Supabase Auth error codes into messages a person can act on.
 * Codes are stable identifiers (messages can change between versions), so
 * we switch on `code` and fall back to a generic, non-scary message.
 */
export function friendlyAuthError(
  error: { code?: string; message?: string; status?: number; name?: string } | null,
): string {
  // Network trouble between our server and Supabase (supabase-js reports it
  // as a retryable fetch error with no HTTP status).
  if (error?.name === "AuthRetryableFetchError" || error?.status === 0) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  switch (error?.code) {
    case "user_already_exists":
    case "email_exists":
      return "That email already has an account. Try signing in instead.";
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute, then try again.";
    case "signup_disabled":
      return "Sign-ups are turned off right now.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "Your session expired. Please sign in again.";
    default:
      return error?.status === 429
        ? "Too many attempts. Wait a minute, then try again."
        : "Something went wrong on our side. Please try again.";
  }
}
