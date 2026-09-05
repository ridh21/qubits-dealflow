import type { Tx } from "@/server/db";
import { derivePaymentStatus } from "@/domain/billing/payment-status";

/**
 * Recomputes and persists the settlement columns for one invoice.
 *
 * balanceMinor and paymentStatus are derived values, but they are stored so the
 * database can filter, sort and aggregate on them. Every write that moves
 * paidMinor, creditAppliedMinor or totalMinor must call this in the same
 * transaction, otherwise the stored state drifts from the amounts.
 *
 * The arithmetic itself stays in the domain layer so stored and displayed
 * settlement can never disagree.
 */
export async function settleInvoiceTotals(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      totalMinor: true,
      paidMinor: true,
      creditAppliedMinor: true,
      dueAt: true,
    },
  });

  const { balanceMinor, paymentStatus } = derivePaymentStatus(
    invoice,
    new Date(),
  );

  return tx.invoice.update({
    where: { id: invoiceId },
    data: { balanceMinor, paymentStatus },
  });
}
