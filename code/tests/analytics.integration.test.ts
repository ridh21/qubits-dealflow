import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testDatabase } from "./helpers/database";
import { buildAnalytics } from "@/server/queries/analytics";
describe.skipIf(!process.env.TEST_DATABASE_URL)("analytics boundaries", () => {
  it("scopes sales and counts current-period payments on older invoices without mixing currencies", async () => {
    const db = testDatabase();
    try {
      const customer = await db.customer.create({
        data: { name: `Analytics ${randomUUID()}` },
      });
      const rep = await db.user.create({
        data: {
          name: "Analytics rep",
          email: `${randomUUID()}@analytics.test`,
          role: "SALES_REP",
          isActive: true,
        },
      });
      const other = await db.user.create({
        data: {
          name: "Other rep",
          email: `${randomUUID()}@analytics.test`,
          role: "SALES_REP",
          isActive: true,
        },
      });
      const filters = {
        from: "2042-09-01",
        to: "2042-09-30",
        customerId: customer.id,
      };
      for (const [owner, currency] of [
        [rep, "USD"],
        [other, "EUR"],
      ] as const) {
        const quote = await db.quotation.create({
          data: {
            number: `ANA-${randomUUID()}`,
            customerId: customer.id,
            ownerId: owner.id,
            currency,
            status: "CONFIRMED",
            createdAt: new Date("2042-09-10"),
          },
        });
        const order = await db.order.create({
          data: {
            number: `ANA-${randomUUID()}`,
            quotationId: quote.id,
            quotationVersion: 1,
            customerId: customer.id,
            currency,
          },
        });
        const invoice = await db.invoice.create({
          data: {
            number: `ANA-${randomUUID()}`,
            customerId: customer.id,
            orderId: order.id,
            type: "ONE_TIME",
            currency,
            issuedAt: new Date("2042-08-01"),
            dueAt: new Date("2042-08-31"),
            subtotalMinor: 10000,
            taxMinor: 0,
            totalMinor: 10000,
            paidMinor: 3000,
            sourceKey: randomUUID(),
          },
        });
        await db.payment.create({
          data: {
            invoiceId: invoice.id,
            amountMinor: 3000,
            method: "BANK",
            recordedById: rep.id,
            paidAt: new Date("2042-09-15"),
            idempotencyKey: randomUUID(),
          },
        });
        await db.payment.create({
          data: {
            invoiceId: invoice.id,
            amountMinor: 1000,
            method: "BANK",
            recordedById: rep.id,
            paidAt: new Date("2042-10-01"),
            idempotencyKey: randomUUID(),
          },
        });
      }
      const own = await buildAnalytics(rep, filters, db);
      expect(
        own.charts
          .find((c) => c.id === "pipeline")
          ?.rows.reduce((n, r) => n + Number(r.value), 0),
      ).toBe(1);
      expect(own.charts.some((c) => c.id === "discount-EUR")).toBe(false);
      const forged = await buildAnalytics(
        rep,
        { ...filters, ownerId: other.id },
        db,
      );
      expect(
        forged.charts
          .find((c) => c.id === "pipeline")
          ?.rows.every((r) => r.value === 0),
      ).toBe(true);
      await expect(
        buildAnalytics(rep, { ...filters, view: "finance" }, db),
      ).rejects.toThrow();
      const finance = await buildAnalytics(
        { ...rep, role: "FINANCE" },
        { ...filters, view: "finance" },
        db,
      );
      for (const currency of ["USD", "EUR"])
        expect(
          finance.charts.find((c) => c.id === `cash-${currency}`)?.rows,
        ).toEqual([{ label: "2042-09", invoiced: 0, cash: 30 }]);
    } finally {
      await db.$disconnect();
    }
  }, 180000);
});
