import { describe, expect, it } from "vitest";
import { fieldErrors, passwordStrength, signInSchema, signUpSchema } from "@/lib/auth/schema";
import { parseProfile } from "@/lib/auth/profile";

describe("sign-up validation", () => {
  const valid = { name: "Cobey", email: "Cobey@Example.com ", password: "planner123", username: "Cobey_D" };

  it("accepts good input and normalizes the email", () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("cobey@example.com");
    expect(result.data?.username).toBe("cobey_d");
  });

  it.each([
    [{ ...valid, name: "   " }, "name", "What should we call you?"],
    [{ ...valid, email: "not-an-email" }, "email", "Enter a valid email, like you@example.com"],
    [{ ...valid, password: "short1" }, "password", "Use at least 8 characters"],
    [{ ...valid, username: "ab" }, "username", "At least 3 characters"],
    [{ ...valid, username: "cobey!" }, "username", "Use only letters, numbers and _"],
    [{ ...valid, username: "user_123" }, "username", "That one's reserved. Try another"],
    [{ ...valid, password: "abcdefghij" }, "password", "Add at least one number"],
    [{ ...valid, password: "1234567890" }, "password", "Add at least one letter"],
  ])("rejects %j with a friendly message on the right field", (input, field, message) => {
    const result = signUpSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)[field]).toBe(message);
  });

  it("log in takes an email or a username, and only requires a password to be present", () => {
    expect(signInSchema.safeParse({ identifier: "a@b.co", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ identifier: "@Cobey_D", password: "x" }).data?.identifier).toBe("cobey_d");
    expect(fieldErrors(signInSchema.safeParse({ identifier: "a b", password: "x" }).error!).identifier).toBe(
      "Enter a valid email or username",
    );
    expect(fieldErrors(signInSchema.safeParse({ identifier: "a@b.co", password: "" }).error!).password).toBe(
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
