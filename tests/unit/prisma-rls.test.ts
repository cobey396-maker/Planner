import type { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { asUser, prismaForUser } from "@/lib/db/rls";
import { createTestDb, createUser } from "../db/harness";

/**
 * The same security, but through Prisma: proves prismaForUser() really runs
 * queries as the user, so a missing `where` can't leak other people's data.
 */
let db: PGlite;
let prisma: PrismaClient;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createTestDb();
  prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
  alice = await createUser(db, "alice@test.dev", { display_name: "Alice" });
  bob = await createUser(db, "bob@test.dev", { display_name: "Bob" });
  await prismaForUser(prisma, alice).task.create({
    data: { userId: alice, title: "Alice's essay", estimatedMinutes: 120 },
  });
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.close();
});

describe("prismaForUser", () => {
  it("a query with NO where clause still only returns your rows", async () => {
    const aliceTasks = await prismaForUser(prisma, alice).task.findMany();
    const bobTasks = await prismaForUser(prisma, bob).task.findMany();
    expect(aliceTasks.map((t) => t.title)).toEqual(["Alice's essay"]);
    expect(bobTasks).toEqual([]);
  });

  it("the bare client (table owner) would see everything, which is why we wrap it", async () => {
    expect(await prisma.task.count()).toBe(1);
  });

  it("refuses to create rows in someone else's name", async () => {
    await expect(
      prismaForUser(prisma, bob).task.create({ data: { userId: alice, title: "sneaky", estimatedMinutes: 30 } }),
    ).rejects.toThrow();
  });

  it("rejects ids that aren't UUIDs before touching the database", () => {
    expect(() => prismaForUser(prisma, "1 or 1=1")).toThrow(/UUID/);
  });

  it("asUser runs multi-step work, including database functions, as the user", async () => {
    const points = await asUser(prisma, alice, async (tx) => {
      const task = await tx.task.findFirstOrThrow();
      const block = await tx.block.create({
        data: {
          userId: alice,
          taskId: task.id,
          startsAt: new Date("2026-10-20T15:00Z"),
          endsAt: new Date("2026-10-20T16:00Z"),
        },
      });
      const [row] = await tx.$queryRaw<{ points: number }[]>`select complete_block(${block.id}::uuid) as points`;
      return row.points;
    });
    expect([100, 150]).toContain(points); // +50 if run before 9 AM
    const ledger = await prismaForUser(prisma, alice).pointsEntry.findMany();
    expect(ledger.reduce((sum, p) => sum + p.points, 0)).toBe(points);
  });
});
