"use client";

import { ArrowLeft, ArrowRight, Globe, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { saveOnboardingAction } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fireConfetti } from "@/lib/confetti";
import { fluid } from "@/lib/design/motion";
import { formatClock, formatDuration } from "@/lib/time";
import { useNow } from "@/lib/use-now";

const START_OPTIONS = [6, 7, 8, 9, 10].map((h) => h * 60);
const END_OPTIONS = [20, 21, 22, 23, 24].map((h) => h * 60);
const STEPS = ["name", "zone", "hours", "done"] as const;

/** The browser's time zone, read only on the client (the server can't know it). */
function useDetectedTimeZone(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/**
 * ONBOARDING: three questions, then a celebration.
 *
 * Everything the auto-planner needs to place tasks sensibly: your name, your
 * time zone (so "6 PM" means 6 PM where you are), and the hours it's allowed
 * to schedule in. Steps slide left/right on the fluid spring; Back keeps your
 * answers. Nothing is saved until you finish.
 */
export function OnboardingScreen({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const now = useNow();
  const detected = useDetectedTimeZone();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState(defaultName === "You" ? "" : defaultName);
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [start, setStart] = useState(7 * 60);
  const [end, setEnd] = useState(22 * 60);
  const [weekStartsOn, setWeekStartsOn] = useState<"1" | "7">("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const timeZone = zoneChoice ?? detected ?? "UTC";
  const zones = useMemo(() => (detected ? Intl.supportedValuesOf("timeZone") : []), [detected]);
  const firstName = name.trim().split(" ")[0] || "friend";

  // Celebrate when the last step appears.
  useEffect(() => {
    if (STEPS[step] === "done") fireConfetti(140);
  }, [step]);

  function go(delta: number) {
    setError(null);
    setDirection(delta);
    setStep((s) => s + delta);
  }

  async function finish() {
    setSaving(true);
    setError(null);
    let result;
    try {
      result = await saveOnboardingAction({
        displayName: name,
        timeZone,
        dayStartMinute: start,
        dayEndMinute: end,
        weekStartsOn: weekStartsOn === "1" ? 1 : 7,
      });
    } catch {
      result = { ok: false as const, error: "Couldn't reach the server. Check your connection and try again." };
    }
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    go(1);
  }

  const canContinue = STEPS[step] !== "name" || name.trim().length > 0;
  const localTime =
    now && new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(now);

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      {/* Progress: one capsule per question, filling with the fluid spring. */}
      <div className="flex h-14 items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Back"
          disabled={step === 0 || STEPS[step] === "done"}
          className="-ml-2 grid size-11 place-items-center rounded-full text-tint disabled:invisible"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={Math.min(step + 1, 3)} aria-label="Setup progress">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
              <motion.div
                className="h-full rounded-full bg-tint"
                initial={false}
                animate={{ width: step >= i ? "100%" : "0%" }}
                transition={fluid}
              />
            </div>
          ))}
        </div>
        <div className="size-11" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center pb-10">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * direction }}
            transition={fluid}
          >
            {STEPS[step] === "name" && (
              <Step emoji="👋" title="What should we call you?" subtitle="This is how friends will see you.">
                <input
                  autoFocus
                  aria-label="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canContinue && go(1)}
                  maxLength={50}
                  autoComplete="name"
                  placeholder="Your name"
                  className="glass-card h-14 w-full rounded-2xl px-4 text-title3 outline-2 outline-transparent placeholder:text-tertiary-label focus:outline-tint"
                />
              </Step>
            )}

            {STEPS[step] === "zone" && (
              <Step emoji="🌎" title="Where are you?" subtitle="So 6 PM on your schedule means 6 PM where you are, even when the clocks change.">
                <label className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
                  <Globe aria-hidden size={20} className="shrink-0 text-tint" />
                  <span className="sr-only">Time zone</span>
                  <select
                    value={timeZone}
                    onChange={(e) => setZoneChoice(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-body outline-none"
                  >
                    {!zones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replaceAll("_", " ")}
                        {z === detected ? " (detected)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {localTime && (
                  <p className="mt-3 px-1 text-subhead text-secondary-label">
                    It&apos;s <span className="font-semibold text-label">{localTime}</span> there right now.
                  </p>
                )}
              </Step>
            )}

            {STEPS[step] === "hours" && (
              <Step emoji="⏰" title="When can we plan tasks?" subtitle="The planner only schedules work inside these hours.">
                <ChipRow label="Start from">
                  {START_OPTIONS.map((m) => (
                    <Chip key={m} group="start" selected={start === m} onClick={() => setStart(m)}>
                      {formatClock(m)}
                    </Chip>
                  ))}
                </ChipRow>
                <ChipRow label="Wrap up by">
                  {END_OPTIONS.map((m) => (
                    <Chip key={m} group="end" selected={end === m} onClick={() => setEnd(m)}>
                      {m === 1440 ? "Midnight" : formatClock(m)}
                    </Chip>
                  ))}
                </ChipRow>
                <p className="mt-1 px-1 text-subhead text-secondary-label">
                  That&apos;s up to <span className="font-semibold text-label">{formatDuration(end - start)}</span> a day.
                  Your classes and work still come first.
                </p>
                <div className="mt-6">
                  <span className="px-1 text-footnote font-medium text-secondary-label">Week starts on</span>
                  <SegmentedControl
                    label="Week starts on"
                    className="mt-2"
                    value={weekStartsOn}
                    onChange={setWeekStartsOn}
                    options={[
                      { value: "1", label: "Monday" },
                      { value: "7", label: "Sunday" },
                    ]}
                  />
                </div>
              </Step>
            )}

            {STEPS[step] === "done" && (
              <Step emoji="🎉" title={`You're all set, ${firstName}!`} subtitle="Add what you need to do and we'll find the time for it.">
                <Button size="lg" className="rounded-full" onClick={() => router.push("/today")}>
                  <Sparkles aria-hidden size={18} /> Plan my week
                </Button>
              </Step>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={fluid}
              className="mt-5 overflow-hidden rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {STEPS[step] !== "done" && (
          <Button
            size="lg"
            className="mt-8 rounded-full"
            disabled={!canContinue || saving}
            onClick={() => (STEPS[step] === "hours" ? void finish() : go(1))}
          >
            {saving ? (
              <Loader2 aria-hidden size={20} className="animate-spin" />
            ) : (
              <>
                {STEPS[step] === "hours" ? "Finish" : "Continue"} <ArrowRight aria-hidden size={18} />
              </>
            )}
          </Button>
        )}
      </div>
    </main>
  );
}

function Step({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <div aria-hidden className="mb-4 text-5xl">
        {emoji}
      </div>
      <h1 className="text-large-title">{title}</h1>
      <p className="mb-7 mt-2 text-body text-secondary-label">{subtitle}</p>
      {children}
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <span className="px-1 text-footnote font-medium text-secondary-label">{label}</span>
      <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">{children}</div>
    </div>
  );
}
