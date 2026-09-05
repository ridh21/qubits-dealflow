import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testDatabase } from "./helpers/database";
import { buildAnalytics } from "@/server/queries/analytics";
import { buildReport } from "@/server/services/report.service";
describe.skipIf(!process.env.TEST_DATABASE_URL)("analytics boundaries", () => {
  it("scopes sales and counts current-period payments on older invoices without mixing currencies", async () => {
    const db = testDatabase();
    try {
      const customer = await db.customer.create({
        data: { name: `Analytics ${randomUUID()}` },
      });
      const team = await db.team.create({
        data: { name: `Analytics team ${randomUUID()}` },
      });
      const rep = await db.user.create({
        data: {
          name: "Analytics rep",
          teamId: team.id,
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
      const plan = await db.subscriptionPlan.findFirstOrThrow({
        where: { interval: "MONTHLY" },
      });
      const peer = await db.user.create({
        data: {
          name: "Team peer",
          email: `${randomUUID()}@analytics.test`,
          role: "SALES_REP",
          teamId: team.id,
          isActive: true,
        },
      });
      await db.quotation.create({
        data: {
          number: `ANA-${randomUUID()}`,
          customerId: customer.id,
          ownerId: peer.id,
          currency: "USD",
          subtotalMinor: 30000,
          discountMinor: 6000,
          totalMinor: 24000,
          createdAt: new Date("2042-09-10"),
        },
      });
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
            subtotalMinor: 10000,
            discountMinor: 1000,
            totalMinor: 9000,
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
        const orderLine = await db.orderLine.create({
          data: {
            orderId: order.id,
            quotationLineId: randomUUID(),
            productId: plan.productId,
            productName: "MRR fixture",
            kind: "SUBSCRIPTION",
            qty: 1,
            unitPriceMinor: 1000,
            netMinor: 1000,
            taxMinor: 0,
            taxBp: 0,
            costPriceMinor: 0,
            planId: plan.id,
            interval: "MONTHLY",
          },
        });
        await db.subscription.create({
          data: {
            orderId: order.id,
            orderLineId: orderLine.id,
            customerId: customer.id,
            planId: plan.id,
            qty: 2,
            unitPriceMinor: 1000,
            status: "ACTIVE",
            activationDate: new Date("2042-08-01"),
            billingAnchor: new Date("2042-08-01"),
            transitions: {
              create: [
                {
                  type: "ACTIVATE",
                  effectiveAt: new Date("2042-08-01"),
                  createdAt: new Date("2042-08-01"),
                  actorType: "SYSTEM",
                },
                {
                  type: "QTY_CHANGED",
                  effectiveAt: new Date("2042-09-20"),
                  createdAt: new Date("2042-09-20"),
                  actorType: "USER",
                  detail: {
                    newQty: 2,
                    newPriceMinor: 1000,
                    newPlanId: plan.id,
                    pending: false,
                  },
                },
              ],
            },
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
        await db.invoice.create({
          data: {
            number: `ANA-${randomUUID()}`,
            customerId: customer.id,
            orderId: order.id,
            type: "ONE_TIME",
            currency,
            issuedAt: new Date("2042-09-20"),
            dueAt: new Date("2042-10-20"),
            subtotalMinor: 7000,
            taxMinor: 0,
            totalMinor: 7000,
            sourceKey: randomUUID(),
          },
        });
        await db.creditNote.create({
          data: {
            number: `ANA-${randomUUID()}`,
            customerId: customer.id,
            sourceInvoiceId: invoice.id,
            currency,
            amountMinor: 1000,
            remainingMinor: 1000,
            reason: "Analytics fixture",
            idempotencyKey: randomUUID(),
            createdAt: new Date("2042-09-22"),
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
      expect(
        own.charts.find((c) => c.id === "discount-USD")?.reference?.value,
      ).toBe(17.5);
      expect(own.charts.find((c) => c.id === "discount-USD")?.rows).toEqual([
        { label: "Analytics rep", value: 10 },
      ]);
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
        new Date("2042-10-15"),
      );
      for (const currency of ["USD", "EUR"])
        expect(
          finance.charts.find((c) => c.id === `cash-${currency}`)?.rows,
        ).toEqual([{ label: "2042-09", invoiced: 70, cash: 30 }]);
      for (const currency of ["USD", "EUR"])
        expect(
          finance.charts.find((c) => c.id === `dso-${currency}`)?.rows,
        ).toEqual([{ label: "DSO", value: 60 }]);
      const report = await buildReport(
        { ...rep, role: "FINANCE" },
        filters,
        db,
      );
      for (const currency of ["USD", "EUR"]) {
        expect(
          finance.charts
            .find((c) => c.id === `mrr-history-${currency}`)
            ?.rows.map((r) => r.value),
        ).toEqual([20]);
        expect(
          finance.charts.find((c) => c.id === `credits-${currency}`)?.rows,
        ).toEqual([{ label: "2042-09", credit: 10, proration: 0 }]);
        expect(
          report.currencies.find((c) => c.currency === currency)?.cashMinor,
        ).toBe(3000);
        expect(
          report.currencies.find((c) => c.currency === currency)?.revenueMinor,
        ).toBe(7000);
      }
    } finally {
      await db.$disconnect();
    }
  }, 180000);
});
