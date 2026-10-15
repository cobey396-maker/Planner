import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The app's one Prisma client (server code only: the "server-only" import
 * makes the build fail if a Client Component ever imports this file, so the
 * database URL can never leak into browser JavaScript).
 *
 * DATABASE_URL is Supabase's POOLED connection (port 6543). Serverless
 * functions start and stop constantly; the pooler (Supavisor) shares a few
 * real Postgres connections between them so we don't run out.
 *
 * In development, Next.js hot-reloads modules on every save. Without the
 * globalThis cache below, each reload would open a NEW connection pool.
 *
 * For user requests, wrap this with prismaForUser() from ./rls so row-level
 * security applies. Use the bare client only for trusted server jobs.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. See DATABASE.md for setup.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
