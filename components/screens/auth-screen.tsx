"use client";

import { ArrowRight, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { requestPasswordResetAction, signInAction, signUpAction, type AuthResult } from "@/app/actions/auth";
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
type Values = { name: string; email: string; password: string };

const COPY = {
  signup: {
    title: "Create your account",
    subtitle: "Tell it what you need to do. It plans your week.",
    submit: "Create account",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
  },
  signin: {
    title: "Welcome back",
    subtitle: "Pick up right where you left off.",
    submit: "Sign in",
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
  const [values, setValues] = useState<Values>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  function validate(next: Values, m: Mode = mode) {
    const result = (m === "signup" ? signUpSchema : signInSchema).safeParse(next);
    return result.success ? {} : fieldErrors(result.error);
  }

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

  function switchMode() {
    const next = mode === "signup" ? "signin" : "signup";
    setMode(next);
    setErrors({});
    setFormError(null);
    setSubmitted(false);
  }

  async function submit() {
    setSubmitted(true);
    setFormError(null);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const email = values.email.trim().toLowerCase();

    if (!authEnabled) {
      // DEMO MODE (no Supabase on this server): remember the name in this
      // browser only, so the app can greet you. No real account is created.
      const name = mode === "signup" ? values.name.trim() : email.split("@")[0];
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
          : await signInAction({ email: values.email, password: values.password });
    } catch {
      result = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }

    if (!result.ok) {
      setBusy(false);
      if (result.fieldErrors) setErrors(result.fieldErrors);
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

        <motion.div variants={fadeUp} className="flex flex-col gap-3">
          <SocialButton
            onClick={() => toast("Sign in with Apple arrives with accounts")}
            className="bg-label text-bg"
            icon={<AppleLogo />}
          >
            Continue with Apple
          </SocialButton>
          <SocialButton
            onClick={() => toast("Sign in with Google arrives with accounts")}
            className="glass-card text-label"
            icon={<GoogleLogo />}
          >
            Continue with Google
          </SocialButton>
        </motion.div>

        <motion.div variants={fadeUp} className="my-6 flex items-center gap-3 text-footnote text-tertiary-label">
          <span className="h-px flex-1 bg-separator" />
          or with email
          <span className="h-px flex-1 bg-separator" />
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
              </motion.div>
            )}
          </AnimatePresence>

          <Field
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
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
            <button type="button" onClick={switchMode} className="font-semibold text-tint">
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
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; trailing?: ReactNode }) {
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
          <input
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="w-full bg-transparent text-body outline-none placeholder:text-tertiary-label focus-visible:outline-none"
            {...input}
          />
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

function SocialButton({
  icon,
  children,
  className,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={fluid}
      className={cn("flex h-[52px] items-center justify-center gap-2.5 rounded-full text-headline", className)}
    >
      {icon}
      {children}
    </motion.button>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}
