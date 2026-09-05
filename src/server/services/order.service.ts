import { startSubscriptionsForOrder } from "./subscription-billing.service";
import { requireQuotationCustomerId } from "@/domain/quotation/require-customer";
import type { Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Conflict, ValidationError } from "@/domain/errors";
import { lockedQuote } from "./quotation.service";
import { nextNumber } from "@/server/sequences";
import { writeAudit } from "@/server/audit";
export async function createOrderFromQuotation(
  tx: Tx,
  quotationId: string,
  version: number,
  actor: SessionUser,
) {
  const q = await lockedQuote(tx, quotationId, version);
  const existing = await tx.order.findUnique({ where: { quotationId } });
  if (existing) return existing;
  if (
    q.approvedVersion !== version ||
    !["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(q.status)
  )
    throw new Conflict("This version is not policy-cleared.");
  const accepted = await tx.quoteAcceptance.findUnique({
    where: { quotationId_version: { quotationId, version } },
  });
  if (!accepted)
    throw new ValidationError(
      "Customer acceptance is required before creating an order.",
    );
  const lines = await tx.quotationLine.findMany({
    where: { quotationId },
    include: { product: { select: { type: true } } },
    orderBy: { sortOrder: "asc" },
  });
  const order = await tx.order.create({
    data: {
      number: await nextNumber(tx, "ORD"),
      quotationId,
      quotationVersion: version,
      customerId: requireQuotationCustomerId(q),
      currency: q.currency,
      promisedDeliveryDate: q.requestedDeliveryDate,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          quotationLineId: l.id,
          kind: l.product.type,
          qty: l.qty,
          unitPriceMinor: l.unitPriceMinor,
          netMinor: l.netMinor,
          taxMinor: l.taxMinor,
          taxBp: l.taxBp,
          costPriceMinor: l.costPriceMinor,
          planId: l.planId,
          interval: l.interval,
          discountBp: l.effectiveDiscountBp,
        })),
      },
    },
  });
  await tx.quotation.update({
    where: { id: quotationId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: actor.role === "CUSTOMER" ? "CUSTOMER" : "USER",
    entityType: "Order",
    entityId: order.id,
    action: "ORDER.CREATED",
    version,
    after: { quotationId, number: order.number },
  });
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: actor.role === "CUSTOMER" ? "CUSTOMER" : "USER",
    entityType: "Quotation",
    entityId: quotationId,
    action: "QUOTATION.CONFIRMED",
    version,
  });
  await startSubscriptionsForOrder(tx, order.id);
  return order;
}
export async function completeOrderIfDone(tx: Tx, id: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id },
    include: {
      lines: { include: { completion: true, subscription: true } },
      invoices: true,
    },
  });
  const done = order.lines.every((l) =>
    l.kind === "PHYSICAL"
      ? l.qtyShipped === l.qty
      : l.kind === "SERVICE"
        ? !!l.completion
        : !!l.subscription && l.subscription.status !== "SCHEDULED",
  );
  if (
    done &&
    order.invoices.length &&
    order.invoices.every(
      (i) =>
        i.status === "VOID" ||
        i.totalMinor - i.paidMinor - i.creditAppliedMinor === 0,
    )
  )
    await tx.order.update({ where: { id }, data: { status: "COMPLETED" } });
}
