import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/**
 * WEB APP MANIFEST (served at /manifest.webmanifest)
 *
 * This file is what makes the site installable. When a phone sees it, it
 * offers "Install app" / "Add to Home Screen", and the installed app opens
 * full-screen (display: standalone) with our icon instead of a browser tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Planner",
    description: APP_TAGLINE,
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash screen and title bar colors (light mode values; matches
    // viewport.themeColor in app/layout.tsx).
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    categories: ["productivity", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "Week", url: "/week" },
    ],
  };
}
