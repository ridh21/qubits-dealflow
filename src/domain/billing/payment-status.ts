export interface PaymentStatusInput {
  totalMinor: number;
  paidMinor: number;
  creditAppliedMinor: number;
  dueAt: Date | null;
}
export interface PaymentStatus {
  balanceMinor: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  isOverdue: boolean;
}

export function derivePaymentStatus(
  input: PaymentStatusInput,
  now: Date,
): PaymentStatus {
  const { totalMinor, paidMinor, creditAppliedMinor, dueAt } = input;
  if (
    ![totalMinor, paidMinor, creditAppliedMinor].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    throw new RangeError("Invalid invoice amounts");
  const balanceMinor = totalMinor - creditAppliedMinor - paidMinor;
  if (balanceMinor < 0)
    throw new RangeError("Payments and applied credits exceed invoice total");
  return {
    balanceMinor,
    paymentStatus:
      balanceMinor === 0
        ? "PAID"
        : paidMinor === 0
          ? "UNPAID"
          : "PARTIALLY_PAID",
    isOverdue: balanceMinor > 0 && dueAt !== null && dueAt < now,
  };
}
