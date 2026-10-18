import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Vitest runs our unit tests. Pure logic (the scheduler, date math, token
// checks) runs in plain Node; files that render React components opt into a
// browser-like DOM with a `// @vitest-environment jsdom` comment at the top.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // "server-only" throws when imported outside a React Server Component
      // build. Tests aren't one, so swap in an empty module.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
