import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  createQuotation,
  addLine,
  createRevision,
} from "@/server/services/quotation.service";
import {
  submitForApproval,
  decideStep,
} from "@/server/services/approval.service";
import type { SessionUser } from "@/server/auth/guards";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "sequential approval governance",
  () => {
    let rep: SessionUser,
      manager: SessionUser,
      finance: SessionUser,
      customerId: string,
      productId: string;
    beforeAll(async () => {
      [rep, manager, finance] = await Promise.all(
        ["rep", "manager", "finance"].map((prefix) =>
          prisma.user.findUniqueOrThrow({
            where: { email: `${prefix}@dealflow360.test` },
          }),
        ),
      );
      customerId = (
        await prisma.customer.findFirstOrThrow({
          where: { name: "Acme Industries" },
        })
      ).id;
      productId = (
        await prisma.product.findUniqueOrThrow({ where: { sku: "SVC-ONSITE" } })
      ).id;
    });
    it("requires manager then finance and blocks obsolete decisions", async () => {
      const q = await createQuotation(rep, { customerId });
      const edited = await addLine(rep, {
        id: q.id,
        expectedVersion: q.version,
        productId,
        qty: 1,
        discountBp: 1800,
        variantValueIds: [],
        addedFromUpsell: false,
      });
      const route = await submitForApproval(rep, q.id, edited.version);
      expect(route.steps).toEqual(["SALES_MANAGER", "FINANCE"]);
      const request = await prisma.approvalRequest.findUniqueOrThrow({
        where: { id: route.requestId },
        include: { steps: { orderBy: { index: "asc" } } },
      });
      await expect(
        decideStep(
          finance,
          request.steps[1].id,
          "APPROVE",
          request.quotationVersion,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await decideStep(
        manager,
        request.steps[0].id,
        "APPROVE",
        request.quotationVersion,
      );
      await createRevision(rep, {
        id: q.id,
        expectedVersion: request.quotationVersion,
        reason: "Customer requested changed terms",
      });
      await expect(
        decideStep(
          finance,
          request.steps[1].id,
          "APPROVE",
          request.quotationVersion,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await prisma.approvalRequest.findUniqueOrThrow({
            where: { id: request.id },
          })
        ).status,
      ).toBe("SUPERSEDED");
    }, 120000);
    it("never lets an administrator approve their own quote", async () => {
      const admin: SessionUser = await prisma.user.findUniqueOrThrow({
        where: { email: "admin@dealflow360.test" },
      });
      const q = await createQuotation(admin, { customerId });
      const edited = await addLine(admin, {
        id: q.id,
        expectedVersion: q.version,
        productId,
        qty: 1,
        discountBp: 1800,
        variantValueIds: [],
        addedFromUpsell: false,
      });
      const r = await submitForApproval(admin, q.id, edited.version);
      const step = await prisma.approvalStep.findFirstOrThrow({
        where: { requestId: r.requestId, index: 0 },
        include: { request: true },
      });
      await expect(
        decideStep(admin, step.id, "APPROVE", step.request.quotationVersion),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }, 120000);
  },
);
