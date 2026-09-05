export type Interval = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export interface LineInput {
  id: string;
  productId: string;
  categoryId: string;
  qty: number;
  unitPriceMinor: number;
  costPriceMinor: number;
  taxBp: number;
  discountBp: number;
  interval: Interval | null;
  sortOrder: number;
}
export interface PricingInput {
  lines: LineInput[];
  orderDiscountBp: number;
  tierCeilingBp: number;
  categoryCeilingsBp: Record<string, number>;
}
export interface PricedLine extends LineInput {
  baseMinor: number;
  lineDiscountMinor: number;
  afterLineMinor: number;
  orderDiscountAllocMinor: number;
  netMinor: number;
  effectiveDiscountBp: number;
  limitBp: number;
  excessBp: number;
  taxMinor: number;
  marginMinor: number;
  marginBp: number | null;
}
export interface CycleSummary {
  netMinor: number;
  taxMinor: number;
  marginMinor: number;
  marginBp: number | null;
  lines: number;
}
export interface PricedQuotation {
  lines: PricedLine[];
  subtotalMinor: number;
  lineDiscountMinor: number;
  orderDiscountMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  oneTime: CycleSummary;
  recurringByCycle: Partial<Record<Interval, CycleSummary>>;
  overallDiscountBp: number;
}
