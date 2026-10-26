/**
 * INSTALLING THE APP (pure helpers, unit-tested in tests/unit/pwa.test.ts)
 *
 * Android and desktop Chrome fire a `beforeinstallprompt` event we can turn
 * into our own "Install app" button. iPhones never do: Safari only installs
 * through Share → Add to Home Screen, so there we show instructions instead.
 */
export type InstallPlatform = "ios" | "prompt" | "installed" | "unsupported";

export function installPlatform(env: {
  userAgent: string;
  /** maxTouchPoints > 1 means an iPad pretending to be a Mac. */
  maxTouchPoints: number;
  standalone: boolean;
  canPrompt: boolean;
}): InstallPlatform {
  if (env.standalone) return "installed";
  const ua = env.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  if (iOS) {
    // Only Safari can add to the home screen on older iOS; other iOS browsers
    // (Chrome = CriOS, Firefox = FxiOS) can't on many versions. Show the
    // steps anyway: since iOS 16.4 they can via their own Share menu.
    return "ios";
  }
  return env.canPrompt ? "prompt" : "unsupported";
}

export const INSTALL_DISMISSED_KEY = "install-dismissed";
