"use client";

import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { passwordStrength, STRENGTH_LABELS } from "@/lib/auth/schema";
import { fadeUp } from "@/lib/design/motion";

/** Choose a new password after following a reset link. */
export function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await updatePasswordAction({ password }).catch(() => ({
      ok: false as const,
      error: "Couldn't reach the server. Try again.",
      fieldErrors: undefined,
    }));
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.password ?? result.error);
      return;
    }
    toast("Password updated");
    router.push("/today");
    router.refresh();
  }

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <motion.form
        variants={fadeUp}
        initial="initial"
        animate="animate"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-4"
      >
        <div className="glass-card grid size-16 place-items-center rounded-[20px] text-tint">
          <KeyRound aria-hidden size={28} />
        </div>
        <h1 className="text-large-title">New password</h1>
        <label className="glass-card flex items-center rounded-2xl pr-2">
          <span className="flex min-w-0 flex-1 flex-col px-4 pb-2 pt-2.5">
            <span className="text-caption font-medium text-secondary-label">New password</span>
            <input
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              aria-invalid={error ? true : undefined}
              className="w-full bg-transparent text-body outline-none placeholder:text-tertiary-label focus-visible:outline-none"
            />
          </span>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="grid size-11 place-items-center rounded-full text-secondary-label"
          >
            {visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </label>
        {password && (
          <p className="px-1 text-footnote text-secondary-label" aria-live="polite">
            Strength: {STRENGTH_LABELS[strength]}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="rounded-full" disabled={busy || !password}>
          {busy ? <Loader2 aria-hidden size={20} className="animate-spin" /> : "Save password"}
        </Button>
      </motion.form>
    </main>
  );
}
