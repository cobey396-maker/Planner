"use client";

import { ArrowRight, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { UsernameHint, useUsernameStatus } from "@/components/planner/username-check";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  type AuthResult,
} from "@/app/actions/auth";
import { saveProfile } from "@/lib/auth/profile";
import {
  fieldErrors,
  PASSWORD_MIN,
  passwordStrength,
  signInSchema,
  signUpSchema,
  STRENGTH_LABELS,
} from "@/lib/auth/schema";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/config";
import { fadeUp, fluid, stagger } from "@/lib/design/motion";

type Mode = "signup" | "signin";
type Values = { name: string; username: string; email: string; password: string };

const COPY = {
  signup: {
    title: "Create your account",
    subtitle: "Tell it what you need to do. It plans your week.",
    submit: "Create account",
    switchPrompt: "Already have an account?",
    switchAction: "Log in",
  },
  signin: {
    title: "Welcome back",
    subtitle: "Log in to pick up right where you left off.",
    submit: "Log in",
    switchPrompt: "New here?",
    switchAction: "Create an account",
  },
} as const;

/**
 * SIGN UP / SIGN IN
 *
 * One screen, two modes. Switching modes animates the Name field in or out
 * (height + fade on the fluid spring) and cross-fades the headline.
 *
 * Validation strategy (the friendly kind):
 *  - Nothing is red while you're still typing your first attempt.
 *  - A field is checked when you leave it (blur), if you typed something.
 *  - After you press the button once, every field re-checks as you type, so
 *    errors disappear the moment they're fixed.
 *
 * Accounts are created for real in Phase 3 (Supabase Auth). Until then,
 * `submit` validates exactly as it will then, remembers your name locally so
 * the app can greet you, and continues into the app.
 */
export function AuthScreen({
  authEnabled,
  linkError = false,
}: {
  /** Supabase is configured: real accounts. Otherwise demo mode. */
  authEnabled: boolean;
  /** Arrived from an expired or already-used email link. */
  linkError?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("signup");
  const [formError, setFormError] = useState<string | null>(
    linkError ? "That link has expired or was already used. Please try again." : null,
  );
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({ name: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  function validate(next: Values, m: Mode = mode) {
    if (m === "signup") {
      const result = signUpSchema.safeParse(next);
      return result.success ? {} : fieldErrors(result.error);
    }
    // Logging in: the first field takes an email OR a username.
    const result = signInSchema.safeParse({ identifier: next.email, password: next.password });
    if (result.success) return {};
    const { identifier, ...rest } = fieldErrors(result.error);
    return identifier ? { ...rest, email: identifier } : rest;
  }

  // Live "available / taken" check while signing up.
  const usernameStatus = useUsernameStatus(values.username, { active: mode === "signup" });

  function update(field: keyof Values, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
    else if (errors[field]) setErrors((prev) => without(prev, field));
  }

  function blur(field: keyof Values) {
    if (!values[field]) return; // Don't scold an empty field you just tabbed past.
    const fieldError = validate(values)[field];
    setErrors((prev) => (fieldError ? { ...prev, [field]: fieldError } : without(prev, field)));
  }

  function switchMode(to?: Mode) {
    const next = to ?? (mode === "signup" ? "signin" : "signup");
    if (next === mode) return;
    setMode(next);
    setErrors({});
    setFormError(null);
    setSubmitted(false);
  }

  async function submit() {
    setSubmitted(true);
    setFormError(null);
    const found = validate(values);
    if (mode === "signup" && usernameStatus.state === "taken") found.username = usernameStatus.message ?? "That username is taken";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const email = values.email.trim().toLowerCase();

    if (!authEnabled) {
      // DEMO MODE (no Supabase on this server): remember the name in this
      // browser only, so the app can greet you. No real account is created.
      const name = mode === "signup" ? values.name.trim() : email.replace(/^@/, "").split("@")[0];
      saveProfile({ name, email });
      toast(mode === "signup" ? `Welcome, ${name.split(" ")[0]}!` : "Welcome back!");
      router.push("/demo");
      return;
    }

    // Real accounts: the server action validates again and talks to Supabase.
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let result: AuthResult;
    try {
      result =
        mode === "signup"
          ? await signUpAction({ ...values, timeZone })
          : await signInAction({ identifier: values.email, password: values.password });
    } catch {
      result = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }

    if (!result.ok) {
      setBusy(false);
      if (result.fieldErrors) {
        const { identifier, ...rest } = result.fieldErrors;
        setErrors(identifier ? { ...rest, email: identifier } : rest);
      }
      setFormError(result.error);
      return;
    }
    if ("checkEmail" in result) {
      setBusy(false);
      setCheckEmail(result.checkEmail);
      return;
    }
    toast(mode === "signup" ? `Welcome, ${values.name.trim().split(" ")[0]}!` : "Welcome back!");
    router.push(result.next);
    router.refresh();
  }

  async function forgotPassword() {
    if (!authEnabled) {
      toast("Password reset needs accounts to be set up");
      return;
    }
    const result = await requestPasswordResetAction({ email: values.email });
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, email: result.fieldErrors?.email ?? result.error }));
      return;
    }
    toast("If that email has an account, a reset link is on its way");
  }

  if (checkEmail) {
    return (
      <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="glass-card rounded-card p-6 text-center">
          <motion.div
            className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-tint/12 text-tint"
            initial={{ scale: 0.6, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={fluid}
          >
            <MailCheck aria-hidden size={30} />
          </motion.div>
          <h1 className="text-title2">Check your inbox</h1>
          <p className="mt-2 text-body text-secondary-label">
            We sent a link to <span className="font-semibold text-label">{checkEmail}</span>. Tap it to finish
            creating your account.
          </p>
          <p className="mt-3 text-footnote text-tertiary-label">Nothing there? Check spam, or wait a minute.</p>
          <Button variant="tinted" className="mt-5 rounded-full" onClick={() => setCheckEmail(null)}>
            Use a different email
          </Button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="flex h-14 items-center justify-end">
        <ThemeToggle className="-mr-2" />
      </div>

      <motion.div
        variants={stagger}
        initial={false}
        animate="animate"
        className="flex flex-1 flex-col justify-center pb-8"
      >
        <motion.div variants={fadeUp} className="mb-7">
          <motion.div
            aria-hidden
            className="glass-card mb-6 grid size-[72px] place-items-center rounded-[22px] text-3xl text-tint"
            animate={{ y: [0, -5, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            ✦
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={fluid}
            >
              <h1 className="text-large-title">{copy.title}</h1>
              <p className="mt-1.5 text-body text-secondary-label">{copy.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-5">
          <SegmentedControl<Mode>
            label="Sign up or log in"
            value={mode}
            onChange={(m) => switchMode(m)}
            options={[
              { value: "signup", label: "Sign up" },
              { value: "signin", label: "Log in" },
            ]}
          />
        </motion.div>

        <motion.form
          variants={fadeUp}
          noValidate
          aria-label={copy.title}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-3"
        >
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={fluid}
                className="-m-1 overflow-hidden p-1"
              >
                <Field
                  label="Name"
                  error={errors.name}
                  value={values.name}
                  onChange={(e) => update("name", e.target.value)}
                  onBlur={() => blur("name")}
                  autoComplete="name"
                  placeholder="Alex Rivera"
                  maxLength={50}
                />
                <div className="mt-3">
                  <Field
                    label="Username"
                    error={errors.username}
                    value={values.username}
                    onChange={(e) => update("username", e.target.value.replace(/\s/g, ""))}
                    onBlur={() => blur("username")}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="alex_r"
                    maxLength={20}
                    leading={
                      <span aria-hidden className="text-body text-tertiary-label">
                        @
                      </span>
                    }
                  />
                  {!errors.username && values.username.trim() !== "" && <UsernameHint status={usernameStatus} name={values.username} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field
            label={mode === "signup" ? "Email" : "Email or username"}
            type={mode === "signup" ? "email" : "text"}
            inputMode={mode === "signup" ? "email" : "text"}
            autoComplete={mode === "signup" ? "email" : "username"}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={mode === "signup" ? "you@example.com" : "you@example.com or @username"}
            error={errors.email}
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => blur("email")}
          />

          <PasswordField
            mode={mode}
            value={values.password}
            error={errors.password}
            onChange={(v) => update("password", v)}
            onBlur={() => blur("password")}
          />

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => void forgotPassword()}
              className="self-end px-1 text-subhead text-tint"
            >
              Forgot password?
            </button>
          )}

          <AnimatePresence initial={false}>
            {formError && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={fluid}
                className="overflow-hidden rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger"
              >
                {formError}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" className="mt-2 rounded-full" disabled={busy}>
            {busy ? (
              <Loader2 aria-hidden size={20} className="animate-spin" />
            ) : (
              <>
                {copy.submit} <ArrowRight aria-hidden size={18} />
              </>
            )}
          </Button>
        </motion.form>

        <motion.div variants={fadeUp} className="mt-5 flex flex-col items-center gap-4 text-center">
          <p className="text-subhead text-secondary-label">
            {copy.switchPrompt}{" "}
            <button type="button" onClick={() => switchMode()} className="font-semibold text-tint">
              {copy.switchAction}
            </button>
          </p>
          {mode === "signup" && (
            <p className="max-w-xs text-footnote text-tertiary-label">
              By creating an account you agree to the {APP_NAME} Terms of Service and Privacy Policy.
            </p>
          )}
          {!authEnabled && (
            <p className="text-caption text-tertiary-label">Demo mode: accounts aren&apos;t set up on this server.</p>
          )}
          <Link href="/demo" prefetch={false} className="text-footnote font-medium text-secondary-label underline-offset-4 hover:underline">
            Just looking? Explore with sample data
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}

/** A copy of `obj` without `key` (state must never be mutated in place). */
function without(obj: Record<string, string>, key: string): Record<string, string> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/**
 * A labeled text field in a glass capsule. The label is a real <label>
 * (tapping it focuses the input), and the error is linked with
 * aria-describedby so screen readers read it right after the field.
 */
function Field({
  label,
  error,
  trailing,
  leading,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; trailing?: ReactNode; leading?: ReactNode }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <div
        className={cn(
          // An outline (not a shadow) marks focus and errors, because the
          // glass-card style already uses box-shadow for its lit rim.
          "glass-card flex items-center rounded-2xl pr-2 outline-2 outline-transparent transition-[outline-color] duration-300",
          error ? "outline-danger" : "focus-within:outline-tint",
        )}
      >
        <label htmlFor={id} className="flex min-w-0 flex-1 flex-col px-4 pb-2 pt-2.5">
          <span className="text-caption font-medium text-secondary-label">{label}</span>
          <span className="flex items-center gap-0.5">
            {leading}
            <input
              id={id}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : input["aria-describedby"]}
              className="w-full bg-transparent text-body outline-none placeholder:text-tertiary-label focus-visible:outline-none"
              {...input}
            />
          </span>
        </label>
        {trailing}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={fluid}
            className="overflow-hidden px-4 pt-1.5 text-footnote text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Password with show/hide, plus a strength meter when creating one. */
function PasswordField({
  mode,
  value,
  error,
  onChange,
  onBlur,
}: {
  mode: Mode;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);
  const strengthColor = ["var(--fill)", "var(--danger)", "var(--warning)", "var(--tint)", "var(--success)"][strength];

  return (
    <div>
      <Field
        label="Password"
        type={visible ? "text" : "password"}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        placeholder={mode === "signup" ? `At least ${PASSWORD_MIN} characters` : "Your password"}
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="grid size-11 shrink-0 place-items-center rounded-full text-secondary-label active:bg-fill"
          >
            {visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        }
      />
      {mode === "signup" && value && !error && (
        <div className="mt-2 flex items-center gap-3 px-4" aria-live="polite">
          <div className="flex flex-1 gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <motion.span
                key={step}
                className="h-1.5 flex-1 rounded-full"
                animate={{ backgroundColor: step <= strength ? strengthColor : "var(--fill)" }}
                transition={fluid}
              />
            ))}
          </div>
          <span className="w-14 text-right text-footnote font-medium text-secondary-label">
            {STRENGTH_LABELS[strength]}
          </span>
        </div>
      )}
    </div>
  );
}
