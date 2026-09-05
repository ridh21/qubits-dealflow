import { describe, it, expect } from "vitest";
import { prisma, withTx } from "@/server/db";
import { createQuotation, addLine } from "@/server/services/quotation.service";
import { submitForApproval } from "@/server/services/approval.service";
import { createOrderFromQuotation } from "@/server/services/order.service";
import {
  proposePlan,
  acceptPlan,
  markShipped,
} from "@/server/services/fulfillment.service";
import { recordPayment } from "@/server/services/payment.service";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/server/auth/guards";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "fulfillment conservation",
  () => {
    it("creates one order and dispatches reserved stock once", async () => {
      const actor: SessionUser = await prisma.user.findUniqueOrThrow({
          where: { email: "admin@dealflow360.test" },
        }),
        customer = await prisma.customer.findFirstOrThrow({
          where: { name: "Acme Industries" },
        }),
        buyer: SessionUser = await prisma.user.findUniqueOrThrow({
          where: { email: "buyer@acme.test" },
        }),
        product = await prisma.product.findUniqueOrThrow({
          where: { sku: "LAP-PRO-14" },
        });
      const q = await createQuotation(actor, { customerId: customer.id });
      const edited = await addLine(actor, {
        id: q.id,
        expectedVersion: q.version,
        productId: product.id,
        qty: 1,
        discountBp: 0,
        variantValueIds: [],
        addedFromUpsell: false,
      });
      await submitForApproval(actor, q.id, edited.version);
      const cleared = await prisma.quotation.findUniqueOrThrow({
        where: { id: q.id },
      });
      await prisma.quoteAcceptance.create({
        data: {
          quotationId: q.id,
          version: cleared.version,
          customerUserId: buyer.id,
        },
      });
      const order = await withTx((tx) =>
        createOrderFromQuotation(tx, q.id, cleared.version, buyer),
      );
      const duplicate = await withTx((tx) =>
        createOrderFromQuotation(tx, q.id, cleared.version, buyer),
      );
      expect(duplicate.id).toBe(order.id);
      const plan = await proposePlan(actor, order.id);
      await acceptPlan(actor, order.id, plan.id);
      const shipment = await prisma.shipment.findFirstOrThrow({
          where: { orderId: order.id },
        }),
        stock = await prisma.stockLevel.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: shipment.warehouseId,
              productId: product.id,
            },
          },
        });
      await markShipped(actor, shipment.id);
      await markShipped(actor, shipment.id);
      const after = await prisma.stockLevel.findUniqueOrThrow({
        where: { id: stock.id },
      });
      expect(after.onHand).toBe(stock.onHand - 1);
      expect(after.reserved).toBe(stock.reserved - 1);
      expect(
        (
          await prisma.orderLine.findFirstOrThrow({
            where: { orderId: order.id },
          })
        ).qtyShipped,
      ).toBe(1);
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { sourceKey: `SHIPMENT:${shipment.id}` },
        include: { lines: true },
      });
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines[0].qty).toBe(1);
      expect(
        await prisma.invoice.count({ where: { shipmentId: shipment.id } }),
      ).toBe(1);
      const input = {
        invoiceId: invoice.id,
        amountMinor: invoice.totalMinor,
        method: "BANK_TRANSFER" as const,
        idempotencyKey: randomUUID(),
      };
      const payments = await Promise.all([
        recordPayment(actor, input),
        recordPayment(actor, input),
      ]);
      expect(payments[0].id).toBe(payments[1].id);
      expect(
        await prisma.payment.count({ where: { invoiceId: invoice.id } }),
      ).toBe(1);
      expect(
        (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
          .paidMinor,
      ).toBe(invoice.totalMinor);
      await expect(
        recordPayment(actor, {
          ...input,
          amountMinor: 1,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow("remaining balance");
    }, 180000);
  },
);
