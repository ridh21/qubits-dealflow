import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { prisma } from "@/server/db";
import { buildReport } from "@/server/services/report.service";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "report access boundaries",
  () => {
    it("applies ownership, team, period and requested owner to every report", async () => {
      const customer = await prisma.customer.create({
        data: { name: `Report fixture ${randomUUID()}` },
      });
      const team = await prisma.team.create({
        data: { name: `Report team ${randomUUID()}` },
      });
      const rep = await prisma.user.create({
        data: {
          name: "Report rep",
          email: `${randomUUID()}@report.test`,
          role: "SALES_REP",
          teamId: team.id,
          isActive: true,
        },
      });
      const other = await prisma.user.create({
        data: {
          name: "Other rep",
          email: `${randomUUID()}@report.test`,
          role: "SALES_REP",
          isActive: true,
        },
      });
      for (const [owner, currency, total] of [
        [rep, "USD", 10000],
        [other, "EUR", 20000],
      ] as const)
        await prisma.quotation.create({
          data: {
            number: `RPT-${randomUUID()}`,
            ownerId: owner.id,
            customerId: customer.id,
            currency,
            totalMinor: total,
            createdAt: new Date("2040-09-15"),
          },
        });
      await prisma.quotation.create({
        data: {
          number: `RPT-${randomUUID()}`,
          ownerId: rep.id,
          customerId: customer.id,
          currency: "USD",
          totalMinor: 999999,
          createdAt: new Date("2040-10-01"),
        },
      });
      const filters = {
        from: "2040-09-01",
        to: "2040-09-30",
        customerId: customer.id,
      };
      const own = await buildReport(rep, filters);
      expect(own.quotations).toHaveLength(1);
      expect(own.quotations[0].totalMinor).toBe(10000);
      expect(own.currencies.map((c) => c.currency)).toEqual(["USD"]);
      expect(
        (await buildReport(rep, { ...filters, ownerId: other.id })).quotations,
      ).toHaveLength(0);
      expect(
        (await buildReport({ ...rep, role: "SALES_MANAGER" }, filters))
          .quotations,
      ).toHaveLength(1);
      const admin = await buildReport({ ...rep, role: "ADMIN" }, filters);
      expect(admin.quotations).toHaveLength(2);
      expect(admin.currencies.map((c) => c.currency)).toEqual(["EUR", "USD"]);
    }, 180000);
  },
);
