import { describe, expect, it } from "vitest";
import { routeFor, safeNext, type Visitor } from "@/lib/auth/routing";

const base: Visitor = { authEnabled: true, signedIn: false, onboarded: false, demo: false };
const signedOut = base;
const newUser = { ...base, signedIn: true };
const member = { ...base, signedIn: true, onboarded: true };
const demo = { ...base, demo: true };

describe("routeFor", () => {
  it("demo mode (no Supabase) lets everything through", () => {
    for (const path of ["/", "/today", "/onboarding", "/settings"]) {
      expect(routeFor(path, { ...signedOut, authEnabled: false })).toBeNull();
    }
  });

  it.each([
    ["/today", "/"],
    ["/week", "/"],
    ["/settings", "/"],
    ["/friends/anything", "/"],
    ["/onboarding", "/"],
    ["/reset-password", "/"],
  ])("signed-out visitors can't open %s", (path, to) => {
    expect(routeFor(path, signedOut)).toBe(to);
  });

  it("signed-out visitors can see the sign-up screen, design system and auth routes", () => {
    for (const path of ["/", "/design", "/design/colors", "/auth/callback", "/demo"]) {
      expect(routeFor(path, signedOut)).toBeNull();
    }
  });

  it("'Explore with sample data' unlocks the app without an account", () => {
    expect(routeFor("/today", demo)).toBeNull();
    expect(routeFor("/onboarding", demo)).toBe("/");
  });

  it("new accounts must finish onboarding first", () => {
    expect(routeFor("/today", newUser)).toBe("/onboarding");
    expect(routeFor("/", newUser)).toBe("/onboarding");
    expect(routeFor("/onboarding", newUser)).toBeNull();
  });

  it("members skip the front door and onboarding", () => {
    expect(routeFor("/", member)).toBe("/today");
    expect(routeFor("/onboarding", member)).toBe("/today");
    expect(routeFor("/week", member)).toBeNull();
    expect(routeFor("/reset-password", member)).toBeNull();
  });

  it("doesn't confuse look-alike paths", () => {
    expect(routeFor("/todays-news", signedOut)).toBeNull();
  });
});

describe("safeNext (open-redirect protection)", () => {
  it.each([
    ["/week", "/week"],
    ["/onboarding?step=2", "/onboarding?step=2"],
    [null, "/today"],
    ["", "/today"],
    ["https://evil.example", "/today"],
    ["//evil.example", "/today"],
    ["/\\evil.example", "/today"],
    ["javascript:alert(1)", "/today"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
