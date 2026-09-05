import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  runForQuotation,
  actOnAlert,
} from "@/server/services/deal-health.service";
import type { SessionUser } from "@/server/auth/guards";
describe.skipIf(!process.env.TEST_DATABASE_URL)("deal health lifecycle", () => {
  it("deduplicates scans, audits a nudge, and resolves after meaningful activity", async () => {
    const actor: SessionUser = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@dealflow360.test" },
    });
    const customer = await prisma.customer.findFirstOrThrow();
    const now = new Date("2030-09-20T00:00:00Z");
    const quote = await prisma.quotation.create({
      data: {
        number: `HLT-${randomUUID()}`,
        ownerId: actor.id,
        customerId: customer.id,
        currency: "USD",
        lastActivityAt: new Date("2030-09-01T00:00:00Z"),
      },
    });
    await Promise.all([
      runForQuotation(quote.id, now),
      runForQuotation(quote.id, now),
    ]);
    const alerts = await prisma.dealHealthAlert.findMany({
      where: { quotationId: quote.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("STALLED");
    await actOnAlert(
      actor,
      alerts[0].id,
      "NUDGE",
      "Please contact the customer.",
    );
    expect(
      await prisma.auditLog.count({
        where: { entityId: alerts[0].id, action: "ALERT.NUDGE" },
      }),
    ).toBe(1);
    await prisma.quotation.update({
      where: { id: quote.id },
      data: { lastActivityAt: now },
    });
    await runForQuotation(quote.id, now);
    expect(
      (
        await prisma.dealHealthAlert.findUniqueOrThrow({
          where: { id: alerts[0].id },
        })
      ).status,
    ).toBe("RESOLVED");
  }, 180000);
});
