import { applyAvailableCredits } from "./credit.service";
import { proportionalSlice } from "@/domain/billing/invoice-lines";
import type { Tx } from "@/server/db";
import { nextNumber } from "@/server/sequences";
import { writeAudit } from "@/server/audit";
import { derivePaymentStatus } from "@/domain/billing/payment-status";
import { ValidationError } from "@/domain/errors";
import { getActivePolicy } from "./policy.service";
interface InvoiceInput {
  customerId: string;
  orderId?: string;
  shipmentId?: string;
  type: "ONE_TIME" | "SERVICE" | "RECURRING" | "PRORATION";
  currency: string;
  sourceKey: string;
  lines: {
    description: string;
    qty: number;
    unitPriceMinor: number;
    amountMinor: number;
    taxMinor: number;
    orderLineId?: string;
    subscriptionId?: string;
    periodStart?: Date;
    periodEnd?: Date;
  }[];
  issuedAt?: Date;
}
export async function issueInvoice(tx: Tx, input: InvoiceInput) {
  const existing = await tx.invoice.findUnique({
    where: { sourceKey: input.sourceKey },
  });
  if (existing) return existing;
  const policy = await getActivePolicy(tx, "BILLING"),
    issuedAt = input.issuedAt ?? new Date(),
    subtotalMinor = input.lines.reduce((s, l) => s + l.amountMinor, 0),
    taxMinor = input.lines.reduce((s, l) => s + l.taxMinor, 0);
  if (subtotalMinor < 0 || taxMinor < 0)
    throw new ValidationError("An invoice cannot have a negative amount.");
  const totalMinor = subtotalMinor + taxMinor;
  // A brand-new invoice has no payments or credits, but the settlement columns
  // are still written here so no row exists in an unsettled state.
  const settlement = derivePaymentStatus(
    { totalMinor, paidMinor: 0, creditAppliedMinor: 0, dueAt: null },
    new Date(),
  );
  const invoice = await tx.invoice.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      shipmentId: input.shipmentId,
      type: input.type,
      currency: input.currency,
      sourceKey: input.sourceKey,
      number: await nextNumber(tx, "INV"),
      issuedAt,
      dueAt: new Date(
        issuedAt.getTime() + policy.payload.invoiceDueDays * 86400000,
      ),
      subtotalMinor,
      taxMinor,
      totalMinor,
      balanceMinor: settlement.balanceMinor,
      paymentStatus: settlement.paymentStatus,
      lines: { create: input.lines },
    },
  });
  await writeAudit(tx, {
    actorType: "SYSTEM",
    entityType: "Invoice",
    entityId: invoice.id,
    action: "INVOICE.ISSUED",
    after: { sourceKey: input.sourceKey, totalMinor: invoice.totalMinor },
  });
  return policy.payload.autoApplyCredits
    ? applyAvailableCredits(tx, invoice.id)
    : invoice;
}
export async function issueShipmentInvoice(tx: Tx, shipmentId: string) {
  const existing = await tx.invoice.findUnique({
    where: { sourceKey: `SHIPMENT:${shipmentId}` },
  });
  if (existing) return existing;
  const shipment = await tx.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: { order: true, lines: { include: { orderLine: true } } },
  });
  if (shipment.status !== "SHIPPED")
    throw new ValidationError("Goods can only be invoiced after dispatch.");
  const lines = shipment.lines.map((l) => {
    const orderLine = l.orderLine;
    if (orderLine.qtyInvoiced + l.qty > orderLine.qtyShipped)
      throw new ValidationError(
        "Cannot invoice more than the dispatched quantity.",
      );
    return {
      description: orderLine.productName,
      qty: l.qty,
      unitPriceMinor: orderLine.unitPriceMinor,
      amountMinor: proportionalSlice(
        orderLine.netMinor,
        orderLine.qty,
        orderLine.qtyInvoiced,
        l.qty,
      ),
      taxMinor: proportionalSlice(
        orderLine.taxMinor,
        orderLine.qty,
        orderLine.qtyInvoiced,
        l.qty,
      ),
      orderLineId: orderLine.id,
    };
  });
  const invoice = await issueInvoice(tx, {
    customerId: shipment.order.customerId,
    orderId: shipment.orderId,
    shipmentId,
    type: "ONE_TIME",
    currency: shipment.order.currency,
    sourceKey: `SHIPMENT:${shipmentId}`,
    lines,
  });
  for (const l of shipment.lines)
    await tx.orderLine.update({
      where: { id: l.orderLineId },
      data: { qtyInvoiced: { increment: l.qty } },
    });
  return invoice;
}
export async function issueCompletionInvoice(tx: Tx, completionId: string) {
  const completion = await tx.serviceCompletion.findUniqueOrThrow({
    where: { id: completionId },
    include: { order: true, orderLine: true },
  });
  if (completion.invoiceId)
    return tx.invoice.findUniqueOrThrow({
      where: { id: completion.invoiceId },
    });
  const l = completion.orderLine;
  const invoice = await issueInvoice(tx, {
    customerId: completion.order.customerId,
    orderId: completion.orderId,
    type: "SERVICE",
    currency: completion.order.currency,
    sourceKey: `COMPLETION:${completionId}`,
    lines: [
      {
        description: l.productName,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        amountMinor: l.netMinor,
        taxMinor: l.taxMinor,
        orderLineId: l.id,
      },
    ],
  });
  await tx.serviceCompletion.update({
    where: { id: completionId },
    data: { invoiceId: invoice.id },
  });
  await tx.orderLine.update({
    where: { id: l.id },
    data: { qtyInvoiced: l.qty },
  });
  return invoice;
}
