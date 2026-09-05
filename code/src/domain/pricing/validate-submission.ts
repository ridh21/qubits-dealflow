import type { PricedQuotation } from "./types";
export function validateForSubmission(
  priced: PricedQuotation,
  policy: { rejectZeroPriceLines: boolean },
  ctx: {
    hasActivePolicy: boolean;
    linesMissingCost: string[];
    categoryCeilingsBp?: Record<string, number>;
  },
) {
  const errors: { code: string; lineId?: string; message: string }[] = [];
  if (!ctx.hasActivePolicy)
    errors.push({
      code: "POLICY_MISSING",
      message: "Publish a discount policy before submission.",
    });
  if (!priced.lines.length)
    errors.push({ code: "NO_LINES", message: "Add at least one line." });
  for (const line of priced.lines) {
    if (policy.rejectZeroPriceLines && line.unitPriceMinor === 0)
      errors.push({
        code: "ZERO_PRICE_LINE",
        lineId: line.id,
        message: "Zero-price lines cannot be submitted.",
      });
    if (ctx.linesMissingCost.includes(line.id))
      errors.push({
        code: "MISSING_COST",
        lineId: line.id,
        message: "Configure the product cost before submission.",
      });
    if (
      ctx.categoryCeilingsBp &&
      ctx.categoryCeilingsBp[line.categoryId] === undefined
    )
      errors.push({
        code: "CATEGORY_CEILING_MISSING",
        lineId: line.id,
        message: "Configure a ceiling for this category.",
      });
  }
  return { ok: errors.length === 0, errors };
}
