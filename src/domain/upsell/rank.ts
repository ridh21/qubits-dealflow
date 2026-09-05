import { ratioBp } from "../money/money";
export interface Candidate {
  productId: string;
  name: string;
  weight: number;
  unitPriceMinor: number;
  costPriceMinor: number;
  minMarginBp: number;
  active: boolean;
  isPromoted: boolean;
  alreadyInQuote: boolean;
}
export function rankSuggestions(
  candidates: Candidate[],
  policy: {
    promotedBoost: number;
    maxSuggestions: number;
    enforceMinMargin: boolean;
    promotions: Record<string, number>;
  },
) {
  return candidates
    .filter(
      (c) =>
        c.active &&
        !c.alreadyInQuote &&
        (!policy.enforceMinMargin ||
          ratioBp(c.unitPriceMinor - c.costPriceMinor, c.unitPriceMinor) >=
            c.minMarginBp),
    )
    .map((c) => ({
      ...c,
      score: c.weight * (c.isPromoted ? policy.promotedBoost : 1),
      marginDeltaMinor: c.unitPriceMinor - c.costPriceMinor,
      promoBp: policy.promotions[c.productId] ?? 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.marginDeltaMinor - a.marginDeltaMinor ||
        a.productId.localeCompare(b.productId),
    )
    .slice(0, policy.maxSuggestions);
}
