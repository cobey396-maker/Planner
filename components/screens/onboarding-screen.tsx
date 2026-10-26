"use client";

import { ArrowLeft, ArrowRight, Check, Download, Globe, Loader2, PlusSquare, Share, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { saveOnboardingAction } from "@/app/actions/onboarding";
import { uploadAvatarAction } from "@/app/actions/profile";
import { useInstall } from "@/components/planner/install-prompt";
import { PlaceFields } from "@/components/planner/place-fields";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import { fluid } from "@/lib/design/motion";
import { useNow } from "@/lib/use-now";

const STEPS = ["name", "photo", "where", "home", "done"] as const;
const QUESTIONS = 4;

/** The browser's time zone, read only on the client (the server can't know it). */
function useDetectedTimeZone(): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/**
 * ONBOARDING: three quick questions, then a celebration.
 *
 * 1. Your name (how friends see you).
 * 2. A profile photo, optional. Skip it and you get your initials instead.
 * 3. Where you are: the time zone (so "6 PM" means 6 PM where you are) and,
 *    optionally, your city and state for "people near you" suggestions.
 * 4. Add the app to your home screen (skipped if it's already installed).
 *    Your answers are saved before this step, so "Maybe later" loses nothing.
 *
 * There are no planning hours: the planner can use all 24 hours of the day.
 * Steps slide left/right on the fluid spring; Back keeps your answers.
 * Nothing is saved until you finish step 3.
 */
export function OnboardingScreen({ defaultName, remote }: { defaultName: string; remote: boolean }) {
  const router = useRouter();
  const now = useNow();
  const detected = useDetectedTimeZone();
  const { platform } = useInstall();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState(defaultName === "You" ? "" : defaultName);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const timeZone = zoneChoice ?? detected ?? "UTC";
  const zones = useMemo(() => (detected ? Intl.supportedValuesOf("timeZone") : []), [detected]);
  const firstName = name.trim().split(" ")[0] || "friend";

  // Celebrate when the last step appears.
  useEffect(() => {
    if (STEPS[step] === "done") fireConfetti(140);
  }, [step]);

  // Free the preview image's memory when it's replaced or we leave.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

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
      result = await saveOnboardingAction({ displayName: name, timeZone, city, region });
      // The photo is a nice-to-have: if it fails, onboarding still succeeds
      // and they can add it later in Settings.
      if (result.ok && remote && photo) {
        const form = new FormData();
        form.append("file", photo.blob, "avatar.jpg");
        await uploadAvatarAction(form).catch(() => null);
      }
    } catch {
      result = { ok: false as const, error: "Couldn't reach the server. Check your connection and try again." };
    }
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Already running as an installed app: no need to ask.
    go(platform === "installed" ? 2 : 1);
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
          disabled={step === 0 || STEPS[step] === "home" || STEPS[step] === "done"}
          className="-ml-2 grid size-11 place-items-center rounded-full text-tint disabled:invisible"
        >
          <ArrowLeft size={22} />
        </button>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={QUESTIONS}
          aria-valuenow={Math.min(step + 1, QUESTIONS)}
          aria-label="Setup progress"
        >
          {Array.from({ length: QUESTIONS }, (_, i) => (
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

            {STEPS[step] === "photo" && (
              <Step emoji="📸" title="Add a profile photo" subtitle="Optional. Skip it and friends see your initials instead.">
                <AvatarPicker
                  name={name}
                  color="blue"
                  src={photo?.url ?? null}
                  onPicked={(blob) => setPhoto({ blob, url: URL.createObjectURL(blob) })}
                />
                {photo && (
                  <Button variant="plain" size="sm" className="mx-auto mt-2 flex" onClick={() => setPhoto(null)}>
                    Use my initials instead
                  </Button>
                )}
                {!remote && photo && (
                  <p className="mt-2 text-center text-footnote text-secondary-label">
                    Demo mode: the photo stays on this screen only.
                  </p>
                )}
              </Step>
            )}

            {STEPS[step] === "where" && (
              <Step emoji="🌎" title="Where are you?" subtitle="Your time zone keeps your schedule right. Your city helps you find friends nearby.">
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
                  <p className="mb-5 mt-2 px-1 text-subhead text-secondary-label">
                    It&apos;s <span className="font-semibold text-label">{localTime}</span> there right now.
                  </p>
                )}
                <PlaceFields city={city} region={region} onCity={setCity} onRegion={setRegion} />
                <p className="mt-2 px-1 text-footnote text-secondary-label">
                  Optional. Only used to suggest people near you, and you can turn that off in Settings.
                </p>
              </Step>
            )}

            {STEPS[step] === "home" && <HomeScreenStep onDone={() => go(1)} />}

            {STEPS[step] === "done" && (
              <Step emoji="🎉" title={`You're all set, ${firstName}!`} subtitle="Add what you need to do and we'll find the time for it.">
                <Button size="lg" className="rounded-full" onClick={() => router.push("/today")}>
                  <Sparkles aria-hidden size={18} /> Let&apos;s go
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

        {STEPS[step] !== "done" && STEPS[step] !== "home" && (
          <Button
            size="lg"
            className="mt-8 rounded-full"
            disabled={!canContinue || saving}
            onClick={() => (STEPS[step] === "where" ? void finish() : go(1))}
          >
            {saving ? (
              <Loader2 aria-hidden size={20} className="animate-spin" />
            ) : (
              <>
                {STEPS[step] === "where" ? "Finish" : STEPS[step] === "photo" && !photo ? "Skip for now" : "Continue"}{" "}
                <ArrowRight aria-hidden size={18} />
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

/**
 * "Add it to your home screen." iPhones can only install from Safari's Share
 * menu, so they get the steps; Android/desktop Chrome get an Install button
 * that opens the browser's own dialog; anything else gets general directions.
 */
function HomeScreenStep({ onDone }: { onDone: () => void }) {
  const { platform, install } = useInstall();
  const [added, setAdded] = useState(false);

  return (
    <Step
      emoji="📲"
      title="Put it on your home screen"
      subtitle="Open your schedule in one tap, full-screen, just like a real app."
    >
      {platform === "ios" && (
        <ol className="glass-card flex flex-col gap-4 rounded-2xl p-4 text-body">
          <InstallStep n={1}>
            Tap <Share aria-label="Share" size={18} className="inline -translate-y-0.5 text-tint" />{" "}
            <strong>Share</strong> at the bottom of Safari
          </InstallStep>
          <InstallStep n={2}>
            Scroll down and tap <PlusSquare aria-hidden size={18} className="inline -translate-y-0.5" />{" "}
            <strong>Add to Home Screen</strong>
          </InstallStep>
          <InstallStep n={3}>
            Tap <strong>Add</strong>
          </InstallStep>
        </ol>
      )}

      {platform === "prompt" && !added && (
        <Button
          size="lg"
          className="rounded-full"
          onClick={async () => {
            if (await install()) setAdded(true);
          }}
        >
          <Download aria-hidden size={18} /> Add to home screen
        </Button>
      )}

      {(added || platform === "installed") && (
        <p className="glass-card flex items-center gap-3 rounded-2xl p-4 text-body" role="status">
          <Check aria-hidden size={20} className="shrink-0 text-success" /> Added! Look for the icon on your home screen.
        </p>
      )}

      {platform === "unsupported" && (
        <p className="glass-card rounded-2xl p-4 text-body text-secondary-label">
          Open this site on your phone, then use your browser&apos;s menu and choose{" "}
          <strong className="text-label">Add to Home screen</strong> or <strong className="text-label">Install app</strong>.
        </p>
      )}

      <Button
        size="lg"
        variant={added || platform === "installed" || platform === "ios" ? "filled" : "plain"}
        className="mt-4 rounded-full"
        onClick={onDone}
      >
        {added || platform === "installed" ? "Continue" : platform === "ios" ? "Done" : "Maybe later"}
        <ArrowRight aria-hidden size={18} />
      </Button>
      {platform === "ios" && (
        <Button variant="plain" size="sm" className="mx-auto mt-1 flex" onClick={onDone}>
          Maybe later
        </Button>
      )}
    </Step>
  );
}

function InstallStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tint text-footnote font-semibold text-on-tint">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
