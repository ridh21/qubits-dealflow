import type { Tx } from "@/server/db";
import { lockRow } from "@/server/db";
import { nextNumber } from "@/server/sequences";
import { writeAudit } from "@/server/audit";
import { Conflict, ValidationError } from "@/domain/errors";
export async function issueCreditNote(
  tx: Tx,
  input: {
    customerId: string;
    subscriptionId?: string;
    sourceInvoiceId?: string;
    currency?: string;
    amountMinor: number;
    reason: string;
    idempotencyKey: string;
    actorId?: string;
  },
) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new ValidationError("Credit must be a positive amount.");
  const existing = await tx.creditNote.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (
      existing.customerId !== input.customerId ||
      existing.amountMinor !== input.amountMinor ||
      existing.sourceInvoiceId !== (input.sourceInvoiceId ?? null) ||
      existing.subscriptionId !== (input.subscriptionId ?? null) ||
      existing.reason !== input.reason ||
      (input.currency !== undefined && existing.currency !== input.currency)
    )
      throw new Conflict("Credit key already used.");
    return existing;
  }
  // Retries above use the saved snapshot: customer settings may have changed.
  const subscription = input.subscriptionId !== undefined
    ? await tx.subscription.findUniqueOrThrow({
        where: { id: input.subscriptionId },
        include: { order: true },
      })
    : null;
  if (
    subscription &&
    (subscription.customerId !== input.customerId ||
      subscription.order.customerId !== input.customerId)
  )
    throw new ValidationError(
      "Credit and subscription order must belong to the same customer.",
    );
  let currency = subscription?.order.currency;
  let refundDueMinor = 0;
  if (input.sourceInvoiceId !== undefined) {
    await lockRow(tx, "Invoice", input.sourceInvoiceId);
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: input.sourceInvoiceId },
    });
    if (invoice.customerId !== input.customerId)
      throw new ValidationError(
        "Credit and invoice must belong to the same customer.",
      );
    if (
      subscription &&
      (invoice.currency !== subscription.order.currency ||
        (invoice.orderId !== null && invoice.orderId !== subscription.orderId))
    )
      throw new ValidationError("Credit invoice and subscription sources conflict.");
    currency = invoice.currency;
    const earlier = await tx.creditNote.aggregate({
      where: { sourceInvoiceId: invoice.id },
      _sum: { amountMinor: true },
    });
    if (
      input.amountMinor + (earlier._sum.amountMinor ?? 0) >
      invoice.totalMinor
    )
      throw new ValidationError("Credits exceed the source invoice amount.");
    const balance =
      invoice.totalMinor - invoice.paidMinor - invoice.creditAppliedMinor;
    refundDueMinor = Math.min(
      invoice.paidMinor,
      Math.max(0, input.amountMinor - balance),
    );
  }
  currency ??= (
    await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } })
  ).currency;
  if (input.currency !== undefined && input.currency !== currency)
    throw new ValidationError("Credit currency must match its source currency.");
  const { actorId, ...data } = input;
  const credit = await tx.creditNote.create({
    data: {
      ...data,
      currency,
      number: await nextNumber(tx, "CN"),
      remainingMinor: input.amountMinor - refundDueMinor,
      refundDueMinor,
      createdById: actorId,
    },
  });
  await writeAudit(tx, {
    actorId,
    actorType: actorId ? "USER" : "SYSTEM",
    entityType: "CreditNote",
    entityId: credit.id,
    action: "CREDIT.ISSUED",
    reason: input.reason,
    after: { amountMinor: credit.amountMinor, refundDueMinor, currency },
  });
  return credit;
}
export async function applyAvailableCredits(tx: Tx, invoiceId: string) {
  await lockRow(tx, "Invoice", invoiceId);
  let invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });
  if (invoice.status !== "ISSUED") return invoice;
  const credits = await tx.creditNote.findMany({
    where: {
      customerId: invoice.customerId,
      currency: invoice.currency,
      remainingMinor: { gt: 0 },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  for (const candidate of credits) {
    await lockRow(tx, "CreditNote", candidate.id);
    const credit = await tx.creditNote.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    // Recheck after the lock, not only when collecting candidates.
    if (
      credit.customerId !== invoice.customerId ||
      credit.currency !== invoice.currency
    )
      continue;
    const amount = Math.min(
      credit.remainingMinor,
      invoice.totalMinor - invoice.paidMinor - invoice.creditAppliedMinor,
    );
    if (amount <= 0) continue;
    await tx.creditApplication.create({
      data: { creditNoteId: credit.id, invoiceId, amountMinor: amount },
    });
    await tx.creditNote.update({
      where: { id: credit.id },
      data: { remainingMinor: { decrement: amount } },
    });
    invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: { creditAppliedMinor: { increment: amount } },
    });
    await writeAudit(tx, {
      actorType: "SYSTEM",
      entityType: "CreditNote",
      entityId: credit.id,
      action: "CREDIT.APPLIED",
      after: { invoiceId, amountMinor: amount },
    });
  }
  return invoice;
}
