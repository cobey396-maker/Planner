import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth/errors";

describe("friendlyAuthError", () => {
  it.each([
    [{ code: "user_already_exists" }, /already has an account/],
    [{ code: "invalid_credentials" }, /incorrect/],
    [{ code: "email_not_confirmed" }, /confirm your email/],
    [{ code: "over_request_rate_limit" }, /Too many attempts/],
    [{ status: 429 }, /Too many attempts/],
    [{ name: "AuthRetryableFetchError", status: 0 }, /Couldn't reach/],
    [{ code: "something_new" }, /Something went wrong/],
    [null, /Something went wrong/],
  ])("%j", (error, message) => {
    expect(friendlyAuthError(error)).toMatch(message);
  });

  it("never echoes Supabase's raw message (which could leak internals)", () => {
    expect(friendlyAuthError({ code: "unexpected", message: "relation auth.foo does not exist" })).not.toMatch(/relation/);
  });
});
