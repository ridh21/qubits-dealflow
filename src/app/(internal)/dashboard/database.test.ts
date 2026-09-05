import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "SALES_REP",
  actorId: "",
  tx: null as Prisma.TransactionClient | null,
}));
vi.mock("@/server/auth/guards", () => ({
  requireInternal: async () => ({
    id: state.actorId,
    role: state.role,
    teamId: "dashboard-team",
    customerId: null,
  }),
}));
vi.mock("@/server/db", () => ({
  // Other dashboard aggregates are covered by query.test.ts. Execute the
  // production activity SQL against PostgreSQL, without stubbing its results.
  prisma: {
    quotation: { groupBy: async () => [], count: async () => 0 },
    approvalRequest: { findMany: async () => [] },
    invoice: { findMany: async () => [], groupBy: async () => [] },
    user: { count: async () => 0 },
    $queryRaw: (query: Prisma.Sql) => {
      if (!state.tx) throw new Error("Dashboard test requires its transaction");
      return state.tx.$queryRaw(query);
    },
  },
}));
import { getDashboard } from "@/server/queries/dashboard";

/** Explicit opt-in: creates a disposable schema and public AuditLog canary inside
 * a transaction that ALWAYS rolls back, including on failure. No seed changes.
 * DASHBOARD_DATABASE_SMOKE=1 with DATABASE_URL (or TEST_DATABASE_URL).
 */
describe.skipIf(process.env.DASHBOARD_DATABASE_SMOKE !== "1")(
  "dashboard database schema isolation",
  () => {
    it("ignores public activity with search_path=public and scopes isolated activity by role", async () => {
      const baseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!baseUrl)
        throw new Error("Configure a database for the schema isolation test");
      const url = new URL(baseUrl);
      const schema = `dashboard_test_${randomUUID().replaceAll("-", "")}`;
      url.searchParams.set("schema", schema);
      vi.stubEnv("DATABASE_URL", url.toString());
      const db = new PrismaClient({
        datasources: { db: { url: url.toString() } },
      });
      const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const rollback = new Error("rollback dashboard isolation fixtures");
      const canary = `${schema}_public_canary`;
      try {
        await expect(
          db.$transaction(
            async (tx) => {
              state.tx = tx;
              await tx.$executeRaw(
                Prisma.sql`CREATE SCHEMA ${Prisma.raw(quoted(schema))}`,
              );
              // LIKE copies columns/defaults, not foreign keys. All fixture writes remain
              // in this transaction; no migrations, resets, or truncations are needed.
              for (const table of [
                "User",
                "Quotation",
                "Order",
                "Invoice",
                "Subscription",
                "QuotationLine",
                "NegotiationMessage",
                "ApprovalStep",
                "ApprovalRequest",
                "Payment",
                "Shipment",
                "FulfillmentPlan",
                "ServiceCompletion",
                "Backorder",
                "OrderLine",
                "DealHealthAlert",
                "CreditNote",
                "AuditLog",
              ]) {
                await tx.$executeRaw(
                  Prisma.sql`CREATE TABLE ${Prisma.raw(`${quoted(schema)}.${quoted(table)}`)} (LIKE ${Prisma.raw(`"public".${quoted(table)}`)} INCLUDING DEFAULTS)`,
                );
              }
              await tx.$queryRaw`SELECT set_config('search_path', 'public', true)`;
              const searchPath = await tx.$queryRaw<
                { current_schema: string }[]
              >`SELECT current_schema()`;
              expect(searchPath[0].current_schema).toBe("public");

              state.actorId = `${schema}_viewer`;
              const owners = [
                state.actorId,
                `${schema}_teammate`,
                `${schema}_outsider`,
              ];
              for (const [index, ownerId] of owners.entries()) {
                await tx.$executeRaw(Prisma.sql`
                  INSERT INTO ${Prisma.raw(`${quoted(schema)}."User"`)} (id, name, email, "teamId")
                  VALUES (${ownerId}, 'Dashboard fixture', ${`${ownerId}@example.test`}, ${index < 2 ? "dashboard-team" : "other-team"})
                `);
                await tx.$executeRaw(Prisma.sql`
                  INSERT INTO ${Prisma.raw(`${quoted(schema)}."Quotation"`)} (id, number, "ownerId", "customerId", "updatedAt")
                  VALUES (${`${ownerId}_quote`}, ${`${ownerId}_quote`}, ${ownerId}, 'isolated-customer', CURRENT_TIMESTAMP)
                `);
                await tx.auditLog.create({
                  data: {
                    id: `${ownerId}_event`,
                    actorId: ownerId,
                    actorType: "USER",
                    entityType: "Quotation",
                    entityId: `${ownerId}_quote`,
                    action: "QUOTATION.CREATED",
                  },
                });
              }
              // A public canary makes the pre-fix query fail deterministically even on
              // an otherwise empty database. This insert is uncommitted and rolled back.
              await tx.$executeRaw`
            INSERT INTO "public"."AuditLog" (id, "actorType", "entityType", "entityId", action)
            VALUES (${canary}, 'SYSTEM', 'Quotation', ${`${state.actorId}_quote`}, 'QUOTATION.CANCELLED')
          `;
              const publicRows = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "AuditLog" WHERE id = ${canary}
          `;
              expect(publicRows).toEqual([{ id: canary }]);

              for (const [role, visibleOwners] of [
                ["SALES_REP", owners.slice(0, 1)],
                ["SALES_MANAGER", owners.slice(0, 2)],
                ["FINANCE", owners],
                ["ADMIN", owners],
              ] as const) {
                state.role = role;
                const data = await getDashboard();
                expect(data.activity.map((row) => row.id).sort(), role).toEqual(
                  visibleOwners.map((id) => `${id}_event`).sort(),
                );
                expect(
                  data.activity.some((row) => row.id === canary),
                  role,
                ).toBe(false);
              }
              throw rollback;
            },
            { timeout: 60000, maxWait: 10000 },
          ),
        ).rejects.toBe(rollback);

        const leftovers = await db.$queryRaw<{ present: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schema}) AS present
        `;
        expect(leftovers).toEqual([{ present: false }]);
        expect(
          await db.$queryRaw`SELECT id FROM "public"."AuditLog" WHERE id = ${canary}`,
        ).toEqual([]);
      } finally {
        state.tx = null;
        vi.unstubAllEnvs();
        await db.$disconnect();
      }
    }, 90000);
  },
);
