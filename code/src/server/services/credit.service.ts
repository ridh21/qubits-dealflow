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
      existing.amountMinor !== input.amountMinor
    )
      throw new Conflict("Credit key already used.");
    return existing;
  }
  let refundDueMinor = 0;
  if (input.sourceInvoiceId) {
    await lockRow(tx, "Invoice", input.sourceInvoiceId);
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: input.sourceInvoiceId },
    });
    if (invoice.customerId !== input.customerId)
      throw new ValidationError(
        "Credit and invoice must belong to the same customer.",
      );
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
  const { actorId, ...data } = input;
  const credit = await tx.creditNote.create({
    data: {
      ...data,
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
    after: { amountMinor: credit.amountMinor, refundDueMinor },
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
    where: { customerId: invoice.customerId, remainingMinor: { gt: 0 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  for (const candidate of credits) {
    await lockRow(tx, "CreditNote", candidate.id);
    const credit = await tx.creditNote.findUniqueOrThrow({
        where: { id: candidate.id },
      }),
      amount = Math.min(
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
