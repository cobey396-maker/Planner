import { defineConfig } from "prisma/config";

// The Prisma CLI doesn't read Next.js's .env.local, so load it here.
// (process.loadEnvFile is built into Node 21+; no dotenv package needed.)
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI, or `prisma generate` before setup): that's fine.
}

/**
 * Prisma CLI configuration.
 *
 * Migrations use DIRECT_URL: a direct connection to Postgres. Supabase's
 * pooled connection (DATABASE_URL, port 6543) runs in "transaction mode",
 * which can't run the schema changes migrations need. The running app uses
 * the pooled URL (see lib/db/prisma.ts) because serverless functions open
 * many short-lived connections.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
