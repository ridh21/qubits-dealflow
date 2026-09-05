import { prisma } from "@/server/db";
import { getActivePolicy } from "./policy.service";
import { rankSuggestions } from "@/domain/upsell/rank";
import { resolveUnitPrice } from "@/domain/pricing/resolve-price";
import { pctOf } from "@/domain/money/money";
export async function suggestionsFor(quotationId: string) {
  const q = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: { lines: true },
  });
  const policy = await getActivePolicy(prisma, "RECOMMENDATION");
  const rules = policy.payload.rules.filter((r) =>
    q.lines.some((l) => l.productId === r.productId),
  );
  const ids = [...new Set(rules.map((r) => r.suggestedProductId))];
  const [products, list] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, type: { not: "SUBSCRIPTION" } },
    }),
    q.priceListId
      ? prisma.priceList.findUnique({
          where: { id: q.priceListId },
          include: { items: true },
        })
      : null,
  ]);
  return rankSuggestions(
    products.map((p) => {
      const price = resolveUnitPrice(p, [], list);
      return {
        productId: p.id,
        name: p.name,
        weight: rules
          .filter((r) => r.suggestedProductId === p.id)
          .reduce((s, r) => s + r.weight, 0),
        unitPriceMinor:
          price - pctOf(price, policy.payload.promotions[p.id] ?? 0),
        costPriceMinor: p.costPriceMinor,
        minMarginBp: p.minMarginBp,
        active: p.status === "ACTIVE",
        isPromoted: p.isPromoted,
        alreadyInQuote: q.lines.some((l) => l.productId === p.id),
      };
    }),
    policy.payload,
  );
}
