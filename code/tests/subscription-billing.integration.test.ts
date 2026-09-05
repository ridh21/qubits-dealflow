import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma, withTx } from "@/server/db";
import { createQuotation } from "@/server/services/quotation.service";
import {
  startSubscriptionsForOrder,
  changeSubscription,
  previewCancel,
  cancelSubscription,
} from "@/server/services/subscription-billing.service";
import { runBilling } from "@/server/services/billing-job";
import { changePause } from "@/server/services/pause-resume.service";
import type { SessionUser } from "@/server/auth/guards";

const at = (value: string) => new Date(`${value}T00:00:00.000Z`);
async function fixture() {
  const actor: SessionUser = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@dealflow360.test" },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { name: "Acme Industries" },
  });
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      sku: `TEST-SUB-${randomUUID()}`,
      name: "Billing integration plan",
      categoryId: category.id,
      type: "SUBSCRIPTION",
      basePriceMinor: 6000,
      costPriceMinor: 0,
    },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      productId: product.id,
      name: "Monthly",
      interval: "MONTHLY",
      priceMinor: 6000,
    },
    include: { product: true },
  });
  const quote = await createQuotation(actor, { customerId: customer.id });
  const order = await prisma.order.create({
    data: {
      number: `TEST-${randomUUID()}`,
      quotationId: quote.id,
      quotationVersion: quote.version,
      customerId: customer.id,
      currency: "USD",
      confirmedAt: at("2030-09-01"),
      lines: {
        create: {
          productId: plan.productId,
          productName: plan.product.name,
          quotationLineId: randomUUID(),
          kind: "SUBSCRIPTION",
          qty: 1,
          unitPriceMinor: 6000,
          netMinor: 6000,
          taxMinor: 0,
          taxBp: 0,
          costPriceMinor: 0,
          planId: plan.id,
          interval: plan.interval,
        },
      },
    },
  });
  await withTx((tx) => startSubscriptionsForOrder(tx, order.id));
  const sub = await prisma.subscription.findFirstOrThrow({
    where: { orderId: order.id },
  });
  return { actor, sub };
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "subscription billing transactions",
  () => {
    it("activates once, prorates a change, and credits cancellation once", async () => {
      const { actor, sub } = await fixture();
      const before = await runBilling(at("2030-08-31"));
      expect(before.failed).toEqual([]);
      expect(
        await prisma.invoice.count({ where: { orderId: sub.orderId } }),
      ).toBe(0);
      expect((await runBilling(at("2030-09-01"))).failed).toEqual([]);
      expect((await runBilling(at("2030-09-01"))).failed).toEqual([]);
      expect(
        await prisma.invoice.count({ where: { orderId: sub.orderId } }),
      ).toBe(1);
      const key = randomUUID();
      await changeSubscription(
        actor,
        sub.id,
        { newQty: 2, idempotencyKey: key },
        at("2030-09-16"),
      );
      await changeSubscription(
        actor,
        sub.id,
        { newQty: 2, idempotencyKey: key },
        at("2030-09-16"),
      );
      const adjustment = await prisma.invoice.findUniqueOrThrow({
        where: { sourceKey: `PRORATION:${key}` },
      });
      expect(adjustment.totalMinor).toBe(3000);
      const preview = await previewCancel(
        sub.id,
        "IMMEDIATE",
        at("2030-09-16"),
      );
      expect(preview.creditMinor).toBe(6000);
      const cancellation = {
        mode: "IMMEDIATE" as const,
        reason: "Customer ended service",
        idempotencyKey: randomUUID(),
      };
      await cancelSubscription(actor, sub.id, cancellation, at("2030-09-16"));
      await cancelSubscription(actor, sub.id, cancellation, at("2030-09-16"));
      expect(
        await prisma.creditNote.count({ where: { subscriptionId: sub.id } }),
      ).toBe(1);
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }))
          .status,
      ).toBe("CANCELLED");
    }, 240000);
    it("processes pause before billing and resumes with exactly one invoice", async () => {
      const { actor, sub } = await fixture();
      expect((await runBilling(at("2030-09-01"))).failed).toEqual([]);
      await changePause(
        actor,
        sub.id,
        { action: "PAUSE", idempotencyKey: randomUUID() },
        at("2030-09-15"),
      );
      await changePause(
        actor,
        sub.id,
        {
          action: "RESUME",
          requestedDate: at("2030-11-15"),
          idempotencyKey: randomUUID(),
        },
        at("2030-09-15"),
      );
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }))
          .resumeAt,
      ).toEqual(at("2030-12-01"));
      expect((await runBilling(at("2030-10-01"))).failed).toEqual([]);
      expect((await runBilling(at("2030-11-01"))).failed).toEqual([]);
      expect(
        await prisma.invoice.count({ where: { orderId: sub.orderId } }),
      ).toBe(1);
      expect((await runBilling(at("2030-12-01"))).failed).toEqual([]);
      expect((await runBilling(at("2030-12-01"))).failed).toEqual([]);
      expect(
        await prisma.invoice.count({ where: { orderId: sub.orderId } }),
      ).toBe(2);
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }))
          .status,
      ).toBe("ACTIVE");
      await cancelSubscription(
        actor,
        sub.id,
        {
          mode: "END_OF_PERIOD",
          reason: "Fixture cleanup",
          idempotencyKey: randomUUID(),
        },
        at("2030-12-15"),
      );
    }, 240000);
  },
);
