import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { prisma } from "@/server/db";
import { createQuotation, addLine } from "@/server/services/quotation.service";
import { submitForApproval } from "@/server/services/approval.service";
import { sendToCustomer } from "@/server/services/portal.service";
import {
  acceptQuotation,
  submitProposals,
  withdrawProposal,
  respondToProposal,
} from "@/server/services/negotiation.service";
import type { SessionUser } from "@/server/auth/guards";
async function fixture() {
  const actor: SessionUser = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@dealflow360.test" },
  });
  const buyer: SessionUser = await prisma.user.findUniqueOrThrow({
    where: { email: "buyer@acme.test" },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { sku: "LAP-PRO-14" },
  });
  const quote = await createQuotation(actor, { customerId: buyer.customerId! });
  const edit = await addLine(actor, {
    id: quote.id,
    expectedVersion: quote.version,
    productId: product.id,
    qty: 1,
    discountBp: 0,
    variantValueIds: [],
    addedFromUpsell: false,
  });
  await submitForApproval(actor, quote.id, edit.version);
  const current = await prisma.quotation.findUniqueOrThrow({
    where: { id: quote.id },
  });
  await sendToCustomer(actor, quote.id, current.version);
  return { actor, buyer, quote: current };
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "portal transaction boundaries",
  { timeout: 180000 },
  () => {
    it("keeps earlier-version proposals actionable without permitting stale writes", async () => {
      const { actor, buyer, quote } = await fixture();
      const line = await prisma.quotationLine.findFirstOrThrow({
        where: { quotationId: quote.id },
      });
      await submitProposals(buyer, quote.id, quote.version, [
        { lineId: line.id, body: "Two units", proposedQty: 2 },
        {
          body: "Please deliver next week",
          requestedDeliveryDate: new Date("2043-01-20"),
        },
        { body: "Please call first" },
      ]);
      const storedMessages = await prisma.negotiationMessage.findMany({
        where: { quotationId: quote.id, author: "CUSTOMER" },
      });
      const messages = [
        "Two units",
        "Please deliver next week",
        "Please call first",
      ].map((body) => storedMessages.find((m) => m.body === body)!);
      const first = await respondToProposal(
        actor,
        messages[0].id,
        "APPLY",
        "Quantity updated",
        quote.version,
      );
      expect(first.revisionVersion).toBeGreaterThan(quote.version);
      await expect(
        respondToProposal(
          actor,
          messages[1].id,
          "APPLY",
          "Stale browser",
          quote.version,
        ),
      ).rejects.toThrow("changed");
      await expect(
        acceptQuotation(buyer, quote.id, first.revisionVersion!),
      ).rejects.toThrow("withdraw");
      const second = await respondToProposal(
        actor,
        messages[1].id,
        "APPLY",
        "Reviewed against current terms",
        first.revisionVersion!,
      );
      await withdrawProposal(buyer, messages[2].id);
      expect(
        (await acceptQuotation(buyer, quote.id, second.revisionVersion!))
          .outcome,
      ).toBe("ORDER_CREATED");
      expect(
        (
          await prisma.quotationLine.findUniqueOrThrow({
            where: { id: line.id },
          })
        ).qty,
      ).toBe(2);
      expect(
        (
          await prisma.negotiationMessage.findUniqueOrThrow({
            where: { id: messages[1].id },
          })
        ).quotationVersion,
      ).toBe(quote.version);
    });
    it("creates one order for concurrent acceptance and hides another customer's quotation", async () => {
      const { buyer, quote } = await fixture();
      await expect(
        acceptQuotation(
          { ...buyer, customerId: randomUUID() },
          quote.id,
          quote.version,
        ),
      ).rejects.toThrow();
      await expect(
        acceptQuotation(buyer, quote.id, quote.version - 1),
      ).rejects.toThrow();
      const outcomes = await Promise.all([
        acceptQuotation(buyer, quote.id, quote.version),
        acceptQuotation(buyer, quote.id, quote.version),
      ]);
      expect(outcomes.map((r) => r.outcome).sort()).toEqual([
        "ALREADY_ACCEPTED",
        "ORDER_CREATED",
      ]);
      expect(
        await prisma.order.count({ where: { quotationId: quote.id } }),
      ).toBe(1);
    });
    it("keeps a proposal separate from terms and requires withdrawal before accepting", async () => {
      const { buyer, quote } = await fixture();
      const line = await prisma.quotationLine.findFirstOrThrow({
        where: { quotationId: quote.id },
      });
      await submitProposals(buyer, quote.id, quote.version, [
        { lineId: line.id, body: "Can we have two units?", proposedQty: 2 },
      ]);
      expect(
        (
          await prisma.quotationLine.findUniqueOrThrow({
            where: { id: line.id },
          })
        ).qty,
      ).toBe(1);
      expect(
        (await prisma.quotation.findUniqueOrThrow({ where: { id: quote.id } }))
          .version,
      ).toBe(quote.version);
      await expect(
        acceptQuotation(buyer, quote.id, quote.version),
      ).rejects.toThrow("withdraw");
      const message = await prisma.negotiationMessage.findFirstOrThrow({
        where: { quotationId: quote.id, author: "CUSTOMER" },
      });
      await withdrawProposal(buyer, message.id);
      expect(
        (await acceptQuotation(buyer, quote.id, quote.version)).outcome,
      ).toBe("ORDER_CREATED");
    });
  },
);
