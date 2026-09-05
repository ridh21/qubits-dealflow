import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  proposePlan,
  acceptPlan,
  consolidateBackorder,
  markShipped,
  onStockReceived,
  declineConsolidation,
} from "@/server/services/fulfillment.service";
import {
  setWarehouseActive,
  receiveStock,
} from "@/server/services/admin/warehouse.service";
import { FulfillmentPolicyZ, BillingPolicyZ } from "@/domain/policy/schemas";

import { registerEventHandlers } from "@/server/events.register";

const schema = "dealflow_test_fulfillment_20260905";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite(
  "fulfillment audit regressions (isolated, no seeds)",
  { timeout: 180000 },
  () => {
    beforeAll(async () => {
      const testUrl = new URL(process.env.TEST_DATABASE_URL!);
      const actualUrl = new URL(process.env.DATABASE_URL!);
      if (
        testUrl.searchParams.get("schema") !== schema ||
        actualUrl.href !== testUrl.href
      )
        throw new Error(
          `This suite requires DATABASE_URL = TEST_DATABASE_URL in ${schema}`,
        );
      registerEventHandlers();
      for (const [kind, payload] of [
        ["FULFILLMENT", FulfillmentPolicyZ.parse({})],
        ["BILLING", BillingPolicyZ.parse({ autoApplyCredits: false })],
      ] as const) {
        // Test configuration only, confined to the explicitly checked disposable schema.
        await prisma.policyVersion.upsert({
          where: { kind_version: { kind, version: 1 } },
          create: { kind, version: 1, payload, isActive: true },
          update: { payload, isActive: true },
        });
      }
    });
    afterAll(() => prisma.$disconnect());

    async function fixture(qty = 5, onHand = 5) {
      const tag = randomUUID();
      const actor = await prisma.user.create({
        data: {
          name: "Ops",
          email: `${tag}@example.test`,
          role: "FINANCE",
          isActive: true,
        },
      });
      const customer = await prisma.customer.create({
        data: { name: `Buyer ${tag}` },
      });
      const category = await prisma.category.create({ data: { name: tag } });
      const product = await prisma.product.create({
        data: {
          name: "Stock item",
          sku: tag,
          categoryId: category.id,
          type: "PHYSICAL",
          basePriceMinor: 100,
          costPriceMinor: 50,
        },
      });
      const warehouse = await prisma.warehouse.create({
        data: {
          name: tag,
          code: tag.toUpperCase(),
          stockLevels: { create: { productId: product.id, onHand } },
        },
      });
      const quotation = await prisma.quotation.create({
        data: { number: tag, ownerId: actor.id, customerId: customer.id },
      });
      const order = await prisma.order.create({
        data: {
          number: tag,
          quotationId: quotation.id,
          quotationVersion: 1,
          customerId: customer.id,
          currency: "USD",
          lines: {
            create: {
              productId: product.id,
              productName: product.name,
              quotationLineId: tag,
              kind: "PHYSICAL",
              qty,
              unitPriceMinor: 100,
              netMinor: qty * 100,
              taxMinor: 0,
              taxBp: 0,
              costPriceMinor: 50,
            },
          },
        },
        include: { lines: true },
      });
      const plan = await proposePlan(actor, order.id);
      return { actor, warehouse, product, order, plan };
    }

    it("rejects a suggestion after its warehouse is deactivated, with no partial reservations", async () => {
      const f = await fixture();
      await setWarehouseActive(f.actor, f.warehouse.id, false);
      await expect(acceptPlan(f.actor, f.order.id, f.plan.id)).rejects.toThrow(
        "inactive",
      );
      expect(
        await prisma.shipment.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      expect(
        await prisma.stockMovement.count({
          where: { productId: f.product.id },
        }),
      ).toBe(0);
      const level = await prisma.stockLevel.findFirstOrThrow({
        where: { productId: f.product.id },
      });
      expect(level.reserved).toBe(0);
    });

    it("serializes deactivation against acceptance: exactly one operation succeeds", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        acceptPlan(f.actor, f.order.id, f.plan.id),
        setWarehouseActive(f.actor, f.warehouse.id, false),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const w = await prisma.warehouse.findUniqueOrThrow({
        where: { id: f.warehouse.id },
        include: { stockLevels: true },
      });
      expect(w.stockLevels[0].reserved).toBe(w.isActive ? 5 : 0);
      expect(
        await prisma.shipment.count({ where: { orderId: f.order.id } }),
      ).toBe(w.isActive ? 1 : 0);
    });

    it("rejects consolidation at an inactive warehouse without inserting an allocation", async () => {
      const f = await fixture(5, 0);
      await acceptPlan(f.actor, f.order.id, f.plan.id);
      const b = await prisma.backorder.findFirstOrThrow({
        where: { orderLineId: f.order.lines[0].id },
      });
      await setWarehouseActive(f.actor, f.warehouse.id, false);
      await expect(
        consolidateBackorder(f.actor, b.id, f.warehouse.id, 2),
      ).rejects.toThrow("inactive");
      expect(
        await prisma.allocation.count({ where: { planId: f.plan.id } }),
      ).toBe(0);
      expect(
        (await prisma.backorder.findUniqueOrThrow({ where: { id: b.id } })).qty,
      ).toBe(5);
    });
    it("reserves and invoices only a bounded partial backorder, retaining the remainder", async () => {
      const f = await fixture(5, 0);
      await acceptPlan(f.actor, f.order.id, f.plan.id);
      const b = await prisma.backorder.findFirstOrThrow({
        where: { orderLineId: f.order.lines[0].id },
      });
      await receiveStock(f.actor, {
        warehouseId: f.warehouse.id,
        productId: f.product.id,
        qty: 2,
      });
      await expect(
        consolidateBackorder(f.actor, b.id, f.warehouse.id, 6),
      ).rejects.toThrow("within the open backorder");
      await expect(
        consolidateBackorder(f.actor, b.id, f.warehouse.id, 3),
      ).rejects.toThrow("Stock changed");
      const shipment = await consolidateBackorder(
        f.actor,
        b.id,
        f.warehouse.id,
        2,
      );
      expect(
        (await prisma.backorder.findUniqueOrThrow({ where: { id: b.id } })).qty,
      ).toBe(3);
      const stock = await prisma.stockLevel.findFirstOrThrow({
        where: { productId: f.product.id },
      });
      expect(stock.reserved).toBe(2);
      await markShipped(f.actor, shipment.id);
      await markShipped(f.actor, shipment.id);
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { shipmentId: shipment.id },
        include: { lines: true },
      });
      expect(invoice.lines[0].qty).toBe(2);
      expect(invoice.totalMinor).toBe(200);
      const line = await prisma.orderLine.findUniqueOrThrow({
        where: { id: b.orderLineId },
      });
      expect(line.qtyShipped).toBe(2);
      expect(line.qtyInvoiced).toBe(2);
      expect(line.qty).toBe(line.qtyShipped + 3);
    });

    it("receipts create deduplicated non-reserving suggestions and Ops notices; decline survives replay", async () => {
      const f = await fixture(5, 0);
      await acceptPlan(f.actor, f.order.id, f.plan.id);
      const b = await prisma.backorder.findFirstOrThrow({
        where: { orderLineId: f.order.lines[0].id },
      });
      const receipt = {
        warehouseId: f.warehouse.id,
        productId: f.product.id,
        qty: 2,
      };
      await receiveStock(f.actor, receipt);
      let current = await prisma.backorder.findUniqueOrThrow({
        where: { id: b.id },
      });
      expect(current).toMatchObject({
        status: "CONSOLIDATION_SUGGESTED",
        suggestedWarehouseId: f.warehouse.id,
        suggestedQty: 2,
        qty: 5,
      });
      const stock = await prisma.stockLevel.findFirstOrThrow({
        where: { productId: f.product.id },
      });
      expect(stock.reserved).toBe(0);
      expect(
        await prisma.shipment.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      const noticeWhere = {
        userId: f.actor.id,
        href: `/fulfillment/${f.order.id}`,
        type: "CONSOLIDATION_SUGGESTED",
      };
      expect(await prisma.notification.count({ where: noticeWhere })).toBe(1);
      await Promise.all([onStockReceived(receipt), onStockReceived(receipt)]);
      expect(await prisma.notification.count({ where: noticeWhere })).toBe(1);
      await declineConsolidation(f.actor, b.id, {
        warehouseId: f.warehouse.id,
        qty: 2,
      });
      await onStockReceived(receipt);
      current = await prisma.backorder.findUniqueOrThrow({
        where: { id: b.id },
      });
      expect(current).toMatchObject({
        status: "OPEN",
        suggestedWarehouseId: null,
        suggestedQty: null,
        qty: 5,
      });
      await receiveStock(f.actor, { ...receipt, qty: 1 });
      current = await prisma.backorder.findUniqueOrThrow({
        where: { id: b.id },
      });
      expect(current.suggestedQty).toBe(3);
      await expect(
        consolidateBackorder(f.actor, b.id, f.warehouse.id, 2, {
          warehouseId: f.warehouse.id,
          qty: 2,
        }),
      ).rejects.toThrow("suggestion changed");
      await consolidateBackorder(f.actor, b.id, f.warehouse.id, 3, {
        warehouseId: f.warehouse.id,
        qty: 3,
      });
      current = await prisma.backorder.findUniqueOrThrow({
        where: { id: b.id },
      });
      expect(current).toMatchObject({
        status: "OPEN",
        qty: 2,
        suggestedWarehouseId: null,
        suggestedQty: null,
      });
      expect(await prisma.notification.count({ where: noticeWhere })).toBe(2);
    });

    it("suggestions prefer a warehouse already used and budget available stock across backorders", async () => {
      const f = await fixture(10, 1);
      await acceptPlan(f.actor, f.order.id, f.plan.id);
      const initial = await prisma.backorder.findFirstOrThrow({
        where: { orderLineId: f.order.lines[0].id },
      });
      await prisma.backorder.update({
        where: { id: initial.id },
        data: { qty: 5 },
      });
      const second = await prisma.backorder.create({
        data: { orderLineId: initial.orderLineId, qty: 4 },
      });
      const other = await prisma.warehouse.create({
        data: {
          name: randomUUID(),
          code: randomUUID().toUpperCase(),
          priority: 0,
          stockLevels: { create: { productId: f.product.id, onHand: 10 } },
        },
      });
      await prisma.warehouse.update({
        where: { id: f.warehouse.id },
        data: { priority: 10 },
      });
      await receiveStock(f.actor, {
        warehouseId: f.warehouse.id,
        productId: f.product.id,
        qty: 2,
      });
      const suggestions = await prisma.backorder.findMany({
        where: { id: { in: [initial.id, second.id] } },
      });
      expect(suggestions.find((b) => b.id === initial.id)).toMatchObject({
        suggestedWarehouseId: f.warehouse.id,
        suggestedQty: 2,
      });
      expect(suggestions.find((b) => b.id === second.id)).toMatchObject({
        suggestedWarehouseId: other.id,
        suggestedQty: 4,
      });
      expect(
        (
          await prisma.stockLevel.findFirstOrThrow({
            where: { warehouseId: f.warehouse.id, productId: f.product.id },
          })
        ).reserved,
      ).toBe(1);
    });
  },
);
