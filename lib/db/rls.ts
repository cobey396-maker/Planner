import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * MAKING PRISMA RESPECT ROW-LEVEL SECURITY
 * =======================================
 *
 * Prisma connects to Postgres as a powerful database user (the table owner),
 * and table owners SKIP row-level security. So by default, a bug like
 * `prisma.task.findMany()` (forgetting `where: { userId }`) would return
 * EVERYONE's tasks.
 *
 * The fix is defense in depth: run each query inside a transaction that
 *   1. sets the same JWT claims Supabase's API would set for this user, and
 *   2. switches to the low-privilege `authenticated` role (SET LOCAL lasts
 *      only until the transaction ends, so pooled connections stay clean).
 * Now the database itself enforces "only your rows", even if our code
 * forgets a filter. This is the same pattern as Prisma's official RLS example.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function claimsFor(userId: string): string {
  if (!UUID.test(userId)) throw new Error("prismaForUser: userId must be a UUID");
  return JSON.stringify({ sub: userId, role: "authenticated" });
}

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * A Prisma client where every model query runs as `userId` under RLS.
 *
 *   const db = prismaForUser(prisma, session.user.id);
 *   await db.task.findMany(); // only this user's tasks, guaranteed by Postgres
 *
 * Column-level grants still apply too: select profile fields explicitly
 * (invite codes are not readable; use the my_invite_code() function).
 */
export function prismaForUser(client: PrismaClient, userId: string) {
  const claims = claimsFor(userId);
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, , result] = await client.$transaction([
            client.$executeRaw`select set_config('request.jwt.claims', ${claims}, true)`,
            client.$executeRaw`set local role authenticated`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/**
 * Several steps as ONE user in ONE transaction (all succeed or none do),
 * including raw SQL such as our database functions:
 *
 *   const awarded = await asUser(prisma, userId, async (tx) => {
 *     const [row] = await tx.$queryRaw<{ points: number }[]>`select complete_block(${id}::uuid) as points`;
 *     return row.points;
 *   });
 */
export async function asUser<T>(client: PrismaClient, userId: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const claims = claimsFor(userId);
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx.$executeRaw`set local role authenticated`;
    return fn(tx);
  });
}
