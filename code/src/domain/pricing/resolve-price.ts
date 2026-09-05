import { applyDiscount } from "@/domain/money/money";

export type PriceRuleKind = "NO_ADJUSTMENT" | "PERCENT_OFF_BASE" | "FIXED_ITEMS";

export interface PricedProduct {
  id: string;
  basePriceMinor: number;
}

export interface ResolvablePriceList {
  rule: PriceRuleKind;
  percentOffBp: number;
  items: { productId: string; priceMinor: number }[];
}

/**
 * The unit price a line starts from, before any line or order discount.
 * A fixed item price wins outright; a percent-off list discounts the base only,
 * never the variant extras, so options are always charged in full.
 */
export function resolveUnitPrice(
  product: PricedProduct,
  variantExtrasMinor: number[],
  priceList: ResolvablePriceList | null,
): number {
  const extras = variantExtrasMinor.reduce((a, b) => a + b, 0);

  if (!priceList) return product.basePriceMinor + extras;

  if (priceList.rule === "FIXED_ITEMS") {
    const item = priceList.items.find((i) => i.productId === product.id);
    if (item) return item.priceMinor + extras;
    return product.basePriceMinor + extras;
  }

  if (priceList.rule === "PERCENT_OFF_BASE") {
    return applyDiscount(product.basePriceMinor, priceList.percentOffBp) + extras;
  }

  // NO_ADJUSTMENT still honours explicit item overrides on the list.
  const item = priceList.items.find((i) => i.productId === product.id);
  if (item) return item.priceMinor + extras;
  return product.basePriceMinor + extras;
}
