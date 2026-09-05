export interface AvailableCredit {
  id: string;
  remainingMinor: number;
  createdAt: Date;
}
export interface CreditApplication {
  creditNoteId: string;
  amountMinor: number;
}
export interface CreditAllocation {
  applications: CreditApplication[];
  creditAppliedMinor: number;
  balanceMinor: number;
  credits: AvailableCredit[];
}

/** Pass the outstanding receivable (after payments and earlier applications). */
export function applyCredits(
  totalMinor: number,
  credits: readonly AvailableCredit[],
): CreditAllocation {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0)
    throw new RangeError("Invalid receivable");
  if (new Set(credits.map((credit) => credit.id)).size !== credits.length)
    throw new RangeError("Duplicate credit");
  const sorted = credits
    .map((credit) => {
      if (
        !Number.isSafeInteger(credit.remainingMinor) ||
        credit.remainingMinor < 0 ||
        !Number.isFinite(credit.createdAt.getTime())
      )
        throw new RangeError("Invalid credit");
      return { ...credit, createdAt: new Date(credit.createdAt) };
    })
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  let balanceMinor = totalMinor;
  const applications: CreditApplication[] = [];
  for (const credit of sorted) {
    const amountMinor = Math.min(balanceMinor, credit.remainingMinor);
    if (amountMinor > 0)
      applications.push({ creditNoteId: credit.id, amountMinor });
    credit.remainingMinor -= amountMinor;
    balanceMinor -= amountMinor;
  }
  return {
    applications,
    creditAppliedMinor: totalMinor - balanceMinor,
    balanceMinor,
    credits: sorted,
  };
}
