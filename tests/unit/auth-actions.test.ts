import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The server actions talk to Supabase, which tests can't (and shouldn't)
 * call. So we replace the Supabase client with a fake that records what it
 * was asked to do and returns whatever each test sets up. This checks OUR
 * logic: validation, the data we send, and how we handle each answer.
 */
const fake = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getClaims: vi.fn(),
    refreshSession: vi.fn(),
  },
  from: vi.fn(),
};
let configured = true;
const cookieJar = { delete: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (configured ? fake : null) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://planner.test" }),
  cookies: async () => cookieJar,
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { signUpAction, signInAction, signOutAction, requestPasswordResetAction, updatePasswordAction } =
  await import("@/app/actions/auth");
const { saveOnboardingAction } = await import("@/app/actions/onboarding");

beforeEach(() => {
  vi.clearAllMocks();
  configured = true;
});

const goodSignUp = { name: " Cobey ", email: "Cobey@Example.com", password: "Planner123", timeZone: "America/Chicago" };

describe("signUpAction", () => {
  it("re-validates on the server and never calls Supabase with bad input", async () => {
    const result = await signUpAction({ name: "", email: "nope", password: "short" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), email: expect.any(String) } });
    expect(fake.auth.signUp).not.toHaveBeenCalled();
  });

  it("sends normalized data, the profile metadata, and a confirm link back to onboarding", async () => {
    fake.auth.signUp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
    expect(await signUpAction(goodSignUp)).toEqual({ ok: true, next: "/onboarding" });
    expect(fake.auth.signUp).toHaveBeenCalledWith({
      email: "cobey@example.com",
      password: "Planner123",
      options: {
        data: { display_name: "Cobey", time_zone: "America/Chicago" },
        emailRedirectTo: "https://planner.test/auth/callback?next=/onboarding",
      },
    });
  });

  it("falls back to UTC for an invalid time zone", async () => {
    fake.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await signUpAction({ ...goodSignUp, timeZone: "Mars/Base" });
    expect(fake.auth.signUp.mock.calls[0][0].options.data.time_zone).toBe("UTC");
  });

  it("asks the user to check their email when confirmation is required", async () => {
    fake.auth.signUp.mockResolvedValue({ data: { user: {}, session: null }, error: null });
    expect(await signUpAction(goodSignUp)).toEqual({ ok: true, checkEmail: "cobey@example.com" });
  });

  it("turns Supabase error codes into friendly messages", async () => {
    fake.auth.signUp.mockResolvedValue({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } });
    expect(await signUpAction(goodSignUp)).toEqual({ ok: false, error: "Too many attempts. Wait a minute, then try again." });
  });

  it("reports when accounts aren't configured (demo mode)", async () => {
    configured = false;
    expect(await signUpAction(goodSignUp)).toMatchObject({ ok: false, error: expect.stringMatching(/aren't set up/) });
  });
});

describe("signInAction", () => {
  it("signs in and heads to Today", async () => {
    fake.auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await signInAction({ email: "a@b.co", password: "x" })).toEqual({ ok: true, next: "/today" });
  });

  it("doesn't reveal whether it was the email or the password that was wrong", async () => {
    fake.auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    expect(await signInAction({ email: "a@b.co", password: "x" })).toEqual({
      ok: false,
      error: "Email or password is incorrect.",
    });
  });
});

describe("password reset", () => {
  it("always says 'check your email', even for unknown addresses", async () => {
    fake.auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found", status: 400 } });
    expect(await requestPasswordResetAction({ email: "ghost@b.co" })).toEqual({ ok: true, checkEmail: "ghost@b.co" });
    expect(fake.auth.resetPasswordForEmail).toHaveBeenCalledWith("ghost@b.co", {
      redirectTo: "https://planner.test/auth/callback?next=/reset-password",
    });
  });

  it("new passwords must meet the same rules as sign-up", async () => {
    expect(await updatePasswordAction({ password: "abc" })).toMatchObject({ ok: false });
    expect(fake.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("signs out, forgets demo mode, and returns to the front door", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
    expect(fake.auth.signOut).toHaveBeenCalled();
    expect(cookieJar.delete).toHaveBeenCalledWith("planner-demo");
  });
});

describe("saveOnboardingAction", () => {
  const answers = {
    displayName: "Cobey",
    timeZone: "America/Chicago",
    dayStartMinute: 8 * 60,
    dayEndMinute: 22 * 60,
    weekStartsOn: 1 as const,
  };

  function tableMock() {
    const calls: Record<string, unknown> = {};
    fake.from.mockImplementation((table: string) => ({
      update: (values: unknown) => ({
        eq: async (col: string, id: string) => {
          calls[table] = { values, col, id };
          return { error: null };
        },
      }),
    }));
    return calls;
  }

  it("saves the profile and settings for the signed-in user, then refreshes the token", async () => {
    const calls = tableMock();
    fake.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    fake.auth.updateUser.mockResolvedValue({ error: null });
    expect(await saveOnboardingAction(answers)).toEqual({ ok: true, next: "/today" });
    expect(calls.profiles).toEqual({ values: { display_name: "Cobey" }, col: "id", id: "user-1" });
    expect(calls.user_settings).toEqual({
      values: { time_zone: "America/Chicago", day_start_minute: 480, day_end_minute: 1320, week_starts_on: 1 },
      col: "user_id",
      id: "user-1",
    });
    expect(fake.auth.updateUser).toHaveBeenCalledWith({ data: { onboarded: true, display_name: "Cobey" } });
    expect(fake.auth.refreshSession).toHaveBeenCalled();
  });

  it("rejects a made-up time zone and a too-short day", async () => {
    expect(await saveOnboardingAction({ ...answers, timeZone: "Narnia/Cair" })).toMatchObject({
      ok: false,
      fieldErrors: { timeZone: expect.any(String) },
    });
    expect(await saveOnboardingAction({ ...answers, dayStartMinute: 600, dayEndMinute: 660 })).toMatchObject({
      ok: false,
      fieldErrors: { dayEndMinute: expect.stringMatching(/3 hours/) },
    });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("refuses if the session has expired", async () => {
    fake.auth.getClaims.mockResolvedValue({ data: null, error: { message: "expired" } });
    expect(await saveOnboardingAction(answers)).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
    expect(fake.from).not.toHaveBeenCalled();
  });
});
