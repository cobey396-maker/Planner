import { z } from "zod";

/**
 * SIGN-UP / SIGN-IN VALIDATION
 *
 * zod schemas describe what valid input looks like, once. The same schema
 * runs in the browser (instant feedback while typing) and, from Phase 3, on
 * the server before anything reaches Supabase. Never trust the browser alone:
 * anyone can skip client-side checks by calling the API directly.
 */

export const PASSWORD_MIN = 8;

// Trim and lowercase FIRST, then check the format, so "You@Mail.com " (a
// trailing space from autofill) is accepted and stored as "you@mail.com".
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email, like you@example.com"));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(72, "That's too long (72 characters max)") // bcrypt's input limit
  .regex(/[A-Za-z]/, "Add at least one letter")
  .regex(/\d/, "Add at least one number");

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "What should we call you?").max(50, "Keep it under 50 characters"),
  email,
  password: newPassword,
});

export const signInSchema = z.object({
  email,
  // On sign-in we only check it's present: the rules belong to sign-up.
  password: z.string().min(1, "Enter your password"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/** Turn zod's error list into { field: "first message" } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Rough password strength, 0–4, for the meter under the field. It rewards
 * length and variety. It's a nudge, not security: real protection is the
 * server's rules plus rate limiting (Phase 3).
 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < PASSWORD_MIN) score = Math.min(score, 1);
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABELS = ["", "Weak", "Okay", "Good", "Strong"] as const;
