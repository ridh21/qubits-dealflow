import { z } from "zod";
import { withTx, lockRow } from "@/server/db";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/guards";
import { Conflict, Forbidden, ValidationError } from "@/domain/errors";
import { completeOrderIfDone } from "./order.service";
export const PaymentInput = z.object({
  invoiceId: z.string().min(1),
  amountMinor: z.number().int().positive().max(2147483647),
  method: z.enum(["BANK_TRANSFER", "CARD", "CASH", "OTHER"]),
  reference: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8).max(200),
});
export async function recordPayment(
  actor: SessionUser,
  raw: z.infer<typeof PaymentInput>,
) {
  if (!["FINANCE", "ADMIN"].includes(actor.role)) throw new Forbidden();
  const input = PaymentInput.parse(raw);
  return withTx(async (tx) => {
    await lockRow(tx, "Invoice", input.invoiceId);
    const existing = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (
        existing.invoiceId !== input.invoiceId ||
        existing.amountMinor !== input.amountMinor ||
        existing.method !== input.method
      )
        throw new Conflict(
          "This payment key was already used for another payment.",
        );
      return existing;
    }
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: input.invoiceId },
    });
    if (invoice.status !== "ISSUED")
      throw new ValidationError("Only issued invoices accept payments.");
    if (
      input.amountMinor >
      invoice.totalMinor - invoice.paidMinor - invoice.creditAppliedMinor
    )
      throw new ValidationError("Payment exceeds the remaining balance.");
    const payment = await tx.payment.create({
      data: { ...input, recordedById: actor.id },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { paidMinor: { increment: input.amountMinor } },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Payment",
      entityId: payment.id,
      action: "PAYMENT.RECORDED",
      after: {
        invoiceId: invoice.id,
        amountMinor: input.amountMinor,
        method: input.method,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Invoice",
      entityId: invoice.id,
      action: "INVOICE.PAYMENT_APPLIED",
      after: { paidMinor: invoice.paidMinor + input.amountMinor },
    });
    if (invoice.orderId) await completeOrderIfDone(tx, invoice.orderId);
    return payment;
  });
}
