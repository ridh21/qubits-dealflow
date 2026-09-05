import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createQuotation,
  addLine,
  updateQuotation,
} from "@/server/services/quotation.service";
import { seedBase } from "../prisma/seed/base";
import { seedCatalogue } from "../prisma/seed/catalogue";
import { seedPolicy } from "../prisma/seed/policy";
import type { SessionUser } from "@/server/auth/guards";
describe.skipIf(!process.env.TEST_DATABASE_URL)("quotation persistence", () => {
  let actor: SessionUser, customerId: string, productId: string;
  beforeAll(async () => {
    await seedBase(prisma);
    await seedCatalogue(prisma);
    await seedPolicy(prisma);
    actor = await prisma.user.findUniqueOrThrow({
      where: { email: "rep@dealflow360.test" },
    });
    customerId = (
      await prisma.customer.findFirstOrThrow({
        where: { name: "Acme Industries" },
      })
    ).id;
    productId = (
      await prisma.product.findUniqueOrThrow({ where: { sku: "LAP-PRO-14" } })
    ).id;
  }, 60000);
  it("snapshots prices and rejects simultaneous stale edits", async () => {
    const q = await createQuotation(actor, { customerId });
    const edit = await addLine(actor, {
      id: q.id,
      expectedVersion: q.version,
      productId,
      qty: 2,
      discountBp: 1200,
      variantValueIds: [],
      addedFromUpsell: false,
    });
    const saved = await prisma.quotation.findUniqueOrThrow({
      where: { id: q.id },
      include: { lines: true, versions: true },
    });
    expect(saved.lines[0]).toMatchObject({
      unitPriceMinor: 108000,
      netMinor: 190080,
    });
    expect(saved.versions).toHaveLength(2);
    const input = {
      id: q.id,
      expectedVersion: edit.version,
      orderDiscountBp: 0,
      customerNote: null,
      requestedDeliveryDate: null,
      validUntil: saved.validUntil,
      lines: saved.lines.map((l) => ({ id: l.id, qty: 3, discountBp: 1200 })),
    };
    const results = await Promise.allSettled([
      updateQuotation(actor, input),
      updateQuotation(actor, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r) => r.status === "rejected");
    expect(failure?.status === "rejected" && failure.reason.code).toBe(
      "CONFLICT",
    );
  }, 60000);
  it("requires a plan for subscriptions", async () => {
    const q = await createQuotation(actor, { customerId });
    const p = await prisma.product.findFirstOrThrow({
      where: { type: "SUBSCRIPTION" },
    });
    await expect(
      addLine(actor, {
        id: q.id,
        expectedVersion: q.version,
        productId: p.id,
        qty: 1,
        discountBp: 0,
        variantValueIds: [],
        addedFromUpsell: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
