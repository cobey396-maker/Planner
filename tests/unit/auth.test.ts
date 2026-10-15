import { describe, expect, it } from "vitest";
import { fieldErrors, passwordStrength, signInSchema, signUpSchema } from "@/lib/auth/schema";
import { parseProfile } from "@/lib/auth/profile";

describe("sign-up validation", () => {
  const valid = { name: "Cobey", email: "Cobey@Example.com ", password: "planner123" };

  it("accepts good input and normalizes the email", () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("cobey@example.com");
  });

  it.each([
    [{ ...valid, name: "   " }, "name", "What should we call you?"],
    [{ ...valid, email: "not-an-email" }, "email", "Enter a valid email, like you@example.com"],
    [{ ...valid, password: "short1" }, "password", "Use at least 8 characters"],
    [{ ...valid, password: "abcdefghij" }, "password", "Add at least one number"],
    [{ ...valid, password: "1234567890" }, "password", "Add at least one letter"],
  ])("rejects %j with a friendly message on the right field", (input, field, message) => {
    const result = signUpSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)[field]).toBe(message);
  });

  it("sign-in only requires a password to be present", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(fieldErrors(signInSchema.safeParse({ email: "a@b.co", password: "" }).error!).password).toBe(
      "Enter your password",
    );
  });
});

describe("passwordStrength", () => {
  it("grows with length and variety", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("planner123")).toBe(1);
    expect(passwordStrength("planner12345")).toBe(2);
    expect(passwordStrength("Planner12345")).toBe(3);
    expect(passwordStrength("Planner12345!")).toBe(4);
  });

  it("never rates a too-short password above Weak", () => {
    expect(passwordStrength("Ab1!")).toBe(1);
  });
});

describe("parseProfile", () => {
  it("reads a saved profile and ignores junk", () => {
    expect(parseProfile('{"name":"Cobey","email":"c@x.co"}')).toEqual({ name: "Cobey", email: "c@x.co" });
    expect(parseProfile("not json")).toBeNull();
    expect(parseProfile('{"name":42}')).toBeNull();
    expect(parseProfile(null)).toBeNull();
  });
});
