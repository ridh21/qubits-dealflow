import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { proposePlan, acceptPlan, consolidateBackorder } from "@/server/services/fulfillment.service";
import { setWarehouseActive } from "@/server/services/admin/warehouse.service";
import { FulfillmentPolicyZ, BillingPolicyZ } from "@/domain/policy/schemas";

const schema = "dealflow_test_fulfillment_20260905";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("fulfillment audit regressions (isolated, no seeds)", () => {
  beforeAll(async () => {
    const testUrl = new URL(process.env.TEST_DATABASE_URL!);
    const actualUrl = new URL(process.env.DATABASE_URL!);
    if (testUrl.searchParams.get("schema") !== schema || actualUrl.href !== testUrl.href)
      throw new Error(`This suite requires DATABASE_URL = TEST_DATABASE_URL in ${schema}`);
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
    const actor = await prisma.user.create({ data: { name: "Ops", email: `${tag}@example.test`, role: "FINANCE", isActive: true } });
    const customer = await prisma.customer.create({ data: { name: `Buyer ${tag}` } });
    const category = await prisma.category.create({ data: { name: tag } });
    const product = await prisma.product.create({ data: { name: "Stock item", sku: tag, categoryId: category.id, type: "PHYSICAL", basePriceMinor: 100, costPriceMinor: 50 } });
    const warehouse = await prisma.warehouse.create({ data: { name: tag, code: tag.toUpperCase(), stockLevels: { create: { productId: product.id, onHand } } } });
    const quotation = await prisma.quotation.create({ data: { number: tag, ownerId: actor.id, customerId: customer.id } });
    const order = await prisma.order.create({ data: {
      number: tag, quotationId: quotation.id, quotationVersion: 1, customerId: customer.id, currency: "USD",
      lines: { create: { productId: product.id, productName: product.name, quotationLineId: tag, kind: "PHYSICAL", qty, unitPriceMinor: 100, netMinor: qty * 100, taxMinor: 0, taxBp: 0, costPriceMinor: 50 } },
    }, include: { lines: true } });
    const plan = await proposePlan(actor, order.id);
    return { actor, warehouse, product, order, plan };
  }

  it("rejects a suggestion after its warehouse is deactivated, with no partial reservations", async () => {
    const f = await fixture();
    await setWarehouseActive(f.actor, f.warehouse.id, false);
    await expect(acceptPlan(f.actor, f.order.id, f.plan.id)).rejects.toThrow("inactive");
    expect(await prisma.shipment.count({ where: { orderId: f.order.id } })).toBe(0);
    expect(await prisma.stockMovement.count({ where: { productId: f.product.id } })).toBe(0);
    const level = await prisma.stockLevel.findFirstOrThrow({ where: { productId: f.product.id } });
    expect(level.reserved).toBe(0);
  });

  it("serializes deactivation against acceptance: exactly one operation succeeds", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      acceptPlan(f.actor, f.order.id, f.plan.id),
      setWarehouseActive(f.actor, f.warehouse.id, false),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const w = await prisma.warehouse.findUniqueOrThrow({ where: { id: f.warehouse.id }, include: { stockLevels: true } });
    expect(w.stockLevels[0].reserved).toBe(w.isActive ? 5 : 0);
    expect(await prisma.shipment.count({ where: { orderId: f.order.id } })).toBe(w.isActive ? 1 : 0);
  });

  it("rejects consolidation at an inactive warehouse without inserting an allocation", async () => {
    const f = await fixture(5, 0);
    await acceptPlan(f.actor, f.order.id, f.plan.id);
    const b = await prisma.backorder.findFirstOrThrow({ where: { orderLineId: f.order.lines[0].id } });
    await setWarehouseActive(f.actor, f.warehouse.id, false);
    await expect(consolidateBackorder(f.actor, b.id, f.warehouse.id, 2)).rejects.toThrow("inactive");
    expect(await prisma.allocation.count({ where: { planId: f.plan.id } })).toBe(0);
    expect((await prisma.backorder.findUniqueOrThrow({ where: { id: b.id } })).qty).toBe(5);
  });
});
