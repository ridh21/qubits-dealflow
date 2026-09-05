import type { PolicyPayload } from "./schemas";
type Rule = PolicyPayload<"RECOMMENDATION">["rules"][number];
/** One vote per directed pair per confirmed order, independent of quantity/duplicate lines. */
export function computeCopurchasePairs(
  orders: readonly { productIds: readonly string[] }[],
): Rule[] {
  const counts = new Map<string, Map<string, number>>();
  for (const order of orders)
    for (const from of new Set(order.productIds))
      for (const to of new Set(order.productIds)) {
        if (from === to) continue;
        const targets = counts.get(from) ?? new Map<string, number>();
        targets.set(to, (targets.get(to) ?? 0) + 1);
        counts.set(from, targets);
      }
  return [...counts]
    .flatMap(([productId, targets]) =>
      [...targets].map(([suggestedProductId, weight]) => ({
        productId,
        suggestedProductId,
        weight,
        source: "COPURCHASE" as const,
      })),
    )
    .sort(
      (a, b) =>
        a.productId.localeCompare(b.productId) ||
        a.suggestedProductId.localeCompare(b.suggestedProductId),
    );
}
export interface RecommendationProduct {
  id: string;
  name: string;
  priceMinor: number;
  costMinor: number;
  minMarginBp: number;
  available: boolean;
  active: boolean;
  promoted: boolean;
}
export function previewRecommendations(
  policy: PolicyPayload<"RECOMMENDATION">,
  productIds: readonly string[],
  products: readonly RecommendationProduct[],
) {
  const current = new Set(productIds);
  return products
    .filter((p) => p.active && p.available && !current.has(p.id))
    .flatMap((p) => {
      const weight = policy.rules
        .filter(
          (r) => current.has(r.productId) && r.suggestedProductId === p.id,
        )
        .reduce((sum, r) => sum + r.weight, 0);
      if (!weight) return [];
      const promotionBp = policy.promotions[p.id] ?? 0;
      const priceMinor =
          p.priceMinor - Math.round((p.priceMinor * promotionBp) / 10000),
        marginMinor = priceMinor - p.costMinor;
      const marginBp =
        priceMinor > 0 ? (marginMinor * 10000) / priceMinor : null;
      if (
        policy.enforceMinMargin &&
        (marginBp === null || marginBp < p.minMarginBp)
      )
        return [];
      return [
        {
          productId: p.id,
          name: p.name,
          score:
            weight + (p.promoted || promotionBp > 0 ? policy.promotedBoost : 0),
          promotionBp,
          priceMinor,
          marginMinor,
          marginBp,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId))
    .slice(0, policy.maxSuggestions);
}
