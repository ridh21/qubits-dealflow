import { beforeAll, describe, expect, it } from "vitest";
import { testDatabase } from "./helpers/database";
import {
  publishPolicy,
  getActivePolicy,
} from "@/server/services/policy.service";
import { POLICY_DEFAULTS } from "@/domain/policy/schemas";
import type { SessionUser } from "@/server/auth/guards";

// Run through scripts/test-database.mjs; never writes to the configured app DB.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "policy publication integration",
  () => {
    let actor: SessionUser;
    beforeAll(async () => {
      const db = testDatabase();
      const user = await db.user.upsert({
        where: { email: "policy-tests@dealflow.test" },
        update: {},
        create: {
          email: "policy-tests@dealflow.test",
          name: "Policy test",
          role: "ADMIN",
          isActive: true,
        },
      });
      actor = { ...user };
      await db.$disconnect();
    });
    it("serializes concurrent publications and leaves one active version", async () => {
      const [a, b] = await Promise.all([
        publishPolicy(
          actor,
          "BILLING",
          POLICY_DEFAULTS.BILLING,
          "Concurrent publication A",
        ),
        publishPolicy(
          actor,
          "BILLING",
          { ...POLICY_DEFAULTS.BILLING, invoiceDueDays: 21 },
          "Concurrent publication B",
        ),
      ]);
      expect(Math.abs(a.version - b.version)).toBe(1);
      const db = testDatabase();
      expect(
        await db.policyVersion.count({
          where: { kind: "BILLING", isActive: true },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { entityId: { in: [a.id, b.id] }, action: "POLICY.PUBLISHED" },
        }),
      ).toBe(2);
      await db.$disconnect();
    });
    it("rejects stale editors and invalid payloads without publishing", async () => {
      const db = testDatabase();
      const active = await getActivePolicy(db, "BILLING");
      const count = await db.policyVersion.count({
        where: { kind: "BILLING" },
      });
      await expect(
        publishPolicy(
          actor,
          "BILLING",
          POLICY_DEFAULTS.BILLING,
          "Stale draft",
          "obsolete",
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        publishPolicy(
          actor,
          "BILLING",
          { ...POLICY_DEFAULTS.BILLING, invoiceDueDays: -1 },
          "Invalid days",
          active.id,
        ),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await db.policyVersion.count({ where: { kind: "BILLING" } })).toBe(
        count,
      );
      await db.$disconnect();
    });
    it("denies finance and manager publications outside their authority", async () => {
      for (const role of [
        "FINANCE",
        "SALES_MANAGER",
        "CUSTOMER",
        "SALES_REP",
      ]) {
        await expect(
          publishPolicy(
            { ...actor, role },
            "BILLING",
            POLICY_DEFAULTS.BILLING,
            "Forbidden publication",
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    });
  },
);
