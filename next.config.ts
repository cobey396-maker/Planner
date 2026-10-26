import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Profile photos are resized in the browser first (~50 KB), but leave room.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Baseline security headers. A full Content-Security-Policy is added in
  // Phase 11, once we know every origin the app talks to (Supabase, Anthropic).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Browsers must always check for a new service worker, or a bad one
        // could stick around for a day after a fix is deployed.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
