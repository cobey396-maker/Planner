import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { installPlatform } from "@/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

const env = { maxTouchPoints: 0, standalone: false, canPrompt: false };

describe("installPlatform", () => {
  it("already installed hides the prompt everywhere", () => {
    expect(installPlatform({ ...env, userAgent: IPHONE, standalone: true })).toBe("installed");
    expect(installPlatform({ ...env, userAgent: ANDROID, standalone: true, canPrompt: true })).toBe("installed");
  });

  it("iPhones and iPads get Share → Add to Home Screen steps", () => {
    expect(installPlatform({ ...env, userAgent: IPHONE })).toBe("ios");
    expect(installPlatform({ ...env, userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe("ios");
  });

  it("a real Mac is not mistaken for an iPad", () => {
    expect(installPlatform({ ...env, userAgent: IPAD_AS_MAC })).toBe("unsupported");
  });

  it("Android shows the Install button only once Chrome offers it", () => {
    expect(installPlatform({ ...env, userAgent: ANDROID })).toBe("unsupported");
    expect(installPlatform({ ...env, userAgent: ANDROID, canPrompt: true })).toBe("prompt");
  });
});

describe("manifest", () => {
  const m = manifest();

  it("opens full-screen on the Today tab", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/today");
  });

  it("has the icons Chrome requires to offer install (192, 512, maskable)", () => {
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
  });
});
