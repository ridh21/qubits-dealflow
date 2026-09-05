import { allocateProportional, pctOf, ratioBp, sum } from "../money/money";
import { ValidationError } from "../errors";
import { resolveLineLimitBp } from "./resolve-limit";
import type {
  CycleSummary,
  PricedLine,
  PricedQuotation,
  PricingInput,
} from "./types";
const MAX_MINOR = 2147483647;
function summary(lines: PricedLine[]): CycleSummary {
  const netMinor = sum(lines.map((l) => l.netMinor)),
    marginMinor = sum(lines.map((l) => l.marginMinor));
  return {
    netMinor,
    taxMinor: sum(lines.map((l) => l.taxMinor)),
    marginMinor,
    marginBp: netMinor ? ratioBp(marginMinor, netMinor) : null,
    lines: lines.length,
  };
}
export function priceQuotation(input: PricingInput): PricedQuotation {
  const bp = (n: number) => Number.isInteger(n) && n >= 0 && n <= 10000;
  if (
    !bp(input.orderDiscountBp) ||
    !bp(input.tierCeilingBp) ||
    Object.values(input.categoryCeilingsBp).some((n) => !bp(n))
  )
    throw new ValidationError(
      "Discounts and ceilings must be between 0 and 100%.",
    );
  if (new Set(input.lines.map((l) => l.id)).size !== input.lines.length)
    throw new ValidationError("Quotation line identifiers must be unique.");
  const sorted = [...input.lines].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  for (const line of sorted) {
    if (
      !Number.isInteger(line.qty) ||
      line.qty < 1 ||
      !Number.isInteger(line.unitPriceMinor) ||
      line.unitPriceMinor < 0 ||
      !Number.isInteger(line.costPriceMinor) ||
      line.costPriceMinor < 0 ||
      !bp(line.discountBp) ||
      !bp(line.taxBp) ||
      line.qty * Math.max(line.unitPriceMinor, line.costPriceMinor) > MAX_MINOR
    )
      throw new ValidationError(
        "Check line quantities, prices, costs and percentages.",
      );
  }
  const base = sorted.map((l) => l.qty * l.unitPriceMinor),
    discounts = sorted.map((l, i) => pctOf(base[i], l.discountBp)),
    post = base.map((n, i) => n - discounts[i]);
  if (sum(base) > MAX_MINOR)
    throw new ValidationError(
      "Quotation exceeds the supported monetary range.",
    );
  const orderDiscountMinor = pctOf(sum(post), input.orderDiscountBp),
    alloc = allocateProportional(orderDiscountMinor, post);
  const lines = sorted.map((l, i): PricedLine => {
    const netMinor = post[i] - alloc[i],
      effectiveDiscountBp = ratioBp(base[i] - netMinor, base[i]),
      limitBp = resolveLineLimitBp(
        input.tierCeilingBp,
        input.categoryCeilingsBp[l.categoryId],
      ),
      marginMinor = netMinor - l.qty * l.costPriceMinor;
    return {
      ...l,
      baseMinor: base[i],
      lineDiscountMinor: discounts[i],
      afterLineMinor: post[i],
      orderDiscountAllocMinor: alloc[i],
      netMinor,
      effectiveDiscountBp,
      limitBp,
      excessBp: Math.max(0, effectiveDiscountBp - limitBp),
      taxMinor: pctOf(netMinor, l.taxBp),
      marginMinor,
      marginBp: netMinor ? ratioBp(marginMinor, netMinor) : null,
    };
  });
  const subtotalMinor = sum(base),
    lineDiscountMinor = sum(discounts),
    taxMinor = sum(lines.map((l) => l.taxMinor)),
    totalMinor = sum(lines.map((l) => l.netMinor)) + taxMinor;
  if (totalMinor > MAX_MINOR)
    throw new ValidationError(
      "Quotation including tax exceeds the supported monetary range.",
    );
  const recurringByCycle: PricedQuotation["recurringByCycle"] = {};
  for (const interval of [
    "WEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
  ] as const) {
    const recurring = lines.filter((l) => l.interval === interval);
    if (recurring.length) recurringByCycle[interval] = summary(recurring);
  }
  return {
    lines,
    subtotalMinor,
    lineDiscountMinor,
    orderDiscountMinor,
    discountMinor: lineDiscountMinor + orderDiscountMinor,
    taxMinor,
    totalMinor,
    oneTime: summary(lines.filter((l) => l.interval === null)),
    recurringByCycle,
    overallDiscountBp: ratioBp(
      lineDiscountMinor + orderDiscountMinor,
      subtotalMinor,
    ),
  };
}
