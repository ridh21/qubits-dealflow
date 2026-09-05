import { afterAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: "SALES_REP" }));
vi.mock("@/server/auth/guards", () => ({
  requireInternal: async () => ({
    id: "dashboard-read-only-scope-check-no-user",
    role: session.role,
    teamId: null,
    customerId: null,
  }),
}));
import { prisma } from "@/server/db";
import { getDashboard } from "@/server/queries/dashboard";

/** Optional smoke against the configured DB; SELECTs only, no fixtures or seed writes.
 * Run with DATABASE_URL and DASHBOARD_DATABASE_SMOKE=1. Never prints business data.
 */
describe.skipIf(process.env.DASHBOARD_DATABASE_SMOKE !== "1")(
  "dashboard read-only database smoke",
  () => {
    afterAll(async () => {
      await prisma.$disconnect();
    });
    it.each(["SALES_REP", "SALES_MANAGER"])(
      "returns no records for a nonexistent %s without a team",
      async (role) => {
        session.role = role;
        const data = await getDashboard();
        expect(data.openQuotations).toBe(0);
        expect(data.atRisk).toBe(0);
        expect(data.pendingApprovals).toBe(0);
        expect(data.unpaidCount).toBe(0);
        expect(data.activity).toEqual([]);
        expect(data.revenue).toBeNull();
      },
      30000,
    );
    it.each(["FINANCE", "ADMIN"])(
      "executes %s aggregate and audit queries",
      async (role) => {
        session.role = role;
        const data = await getDashboard();
        expect(data.openQuotations).toBeGreaterThanOrEqual(0);
        expect(data.revenue).not.toBeNull();
        expect(data.pipeline).toBeNull();
        expect(data.activity.length).toBeLessThanOrEqual(12);
        expect(
          new Set(data.invoiceBalances.map((row) => row.currency)).size,
        ).toBe(data.invoiceBalances.length);
      },
      30000,
    );
  },
);
