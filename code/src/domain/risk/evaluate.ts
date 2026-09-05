import Decimal from "decimal.js";
import { pctOf, allocateProportional, ratioBp } from "../money/money";
import { z } from "zod";
import { BpZ, type PolicyPayload } from "../policy/schemas";
import { parsePolicy } from "../policy/validate-discount-risk";
import { ConfigurationError, ValidationError } from "../errors";
export const SimInputZ = z.object({
  tier: z.enum(["BRONZE", "SILVER", "GOLD"]),
  orderDiscountBp: BpZ,
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().min(1),
        baseMinor: z.number().int().min(0).max(2147483647),
        discountBp: BpZ,
        cycle: z
          .enum(["ONE_TIME", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"])
          .default("ONE_TIME"),
      }),
    )
    .min(1)
    .max(500),
});
export type SimInput = z.infer<typeof SimInputZ>;
export interface RiskLine {
  id: string;
  cycle: string;
  baseMinor: number;
  netMinor: number;
  effectiveDiscountBp: number | null;
  limitBp: number;
  excessBp: number;
}
export interface RiskBucket {
  cycle: string;
  worstExcessBp: number;
  blendedExcessBp: number;
  overallDiscountBp: number | null;
  overallExcessBp: number | null;
  firedRules: { level: number; label: string; reasons: string[] }[];
  requiredLevel: number;
}
export interface SimResult {
  lines: RiskLine[];
  buckets: RiskBucket[];
  requiredLevel: number;
  route: PolicyPayload<"DISCOUNT_RISK">["reviewerChain"];
  explanations: string[];
}
/** Read-only evaluation; money rounds half-up and order discount residuals use stable line order. */
export function simulateDiscountRisk(
  payload: PolicyPayload<"DISCOUNT_RISK">,
  input: SimInput,
): SimResult {
  const p = parsePolicy("DISCOUNT_RISK", payload),
    parsed = SimInputZ.safeParse(input);
  if (!parsed.success)
    throw new ValidationError(parsed.error.issues[0].message);
  const sample = parsed.data;
  if (new Set(sample.lines.map((l) => l.id)).size !== sample.lines.length)
    throw new ValidationError("Sample line identifiers must be unique.");
  const post = sample.lines.map(
    (l) => l.baseMinor - pctOf(l.baseMinor, l.discountBp),
  );
  const allocations = allocateProportional(
    pctOf(
      post.reduce((s, n) => s + n, 0),
      sample.orderDiscountBp,
    ),
    post,
  );
  const priced = sample.lines.map((l, i) => ({
    ...l,
    netMinor: post[i] - allocations[i],
  }));
  const grouped = new Map<string, typeof priced>();
  for (const l of priced) {
    const key = p.evaluateRecurringInCycleBuckets ? l.cycle : "COMBINED";
    grouped.set(key, [...(grouped.get(key) ?? []), l]);
  }
  const lines: RiskLine[] = [],
    buckets: RiskBucket[] = [];
  for (const [cycle, items] of grouped) {
    const evaluated = items.map((l): RiskLine => {
      const category = p.categoryCeilingsBp[l.categoryId];
      if (category === undefined)
        throw new ConfigurationError(
          `Set a discount ceiling for category ${l.categoryId}.`,
          { code: "CATEGORY_CEILING_MISSING", categoryId: l.categoryId },
        );
      if (l.baseMinor === 0 && p.rejectZeroPriceLines)
        throw new ValidationError(
          "Zero-price lines are disabled by this policy.",
        );
      const effective = l.baseMinor
        ? ratioBp(l.baseMinor - l.netMinor, l.baseMinor)
        : null;
      const limit = Math.min(category, p.tierCeilingsBp[sample.tier]);
      return {
        id: l.id,
        cycle,
        baseMinor: l.baseMinor,
        netMinor: l.netMinor,
        effectiveDiscountBp: effective,
        limitBp: limit,
        excessBp: effective === null ? 0 : Math.max(0, effective - limit),
      };
    });
    lines.push(...evaluated);
    const base = evaluated.reduce(
      (a, l) => a.plus(l.baseMinor),
      new Decimal(0),
    );
    const net = evaluated.reduce((a, l) => a.plus(l.netMinor), new Decimal(0));
    const worst = Math.max(...evaluated.map((l) => l.excessBp));
    const blended = base.isZero()
      ? 0
      : evaluated
          .reduce(
            (a, l) => a.plus(new Decimal(l.baseMinor).mul(l.excessBp)),
            new Decimal(0),
          )
          .div(base)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();
    const overall = base.isZero()
      ? null
      : base
          .minus(net)
          .mul(10000)
          .div(base)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();
    const overallExcess =
      overall === null || p.overallCeilingBp === null
        ? null
        : Math.max(0, overall - p.overallCeilingBp);
    const firedRules = p.routingRules.flatMap((r) => {
      const reasons: string[] = [];
      if (r.anyLineExcess && worst > 0)
        reasons.push("At least one line exceeds its ceiling.");
      if (r.worstExcessGteBp !== null && worst >= r.worstExcessGteBp)
        reasons.push(`Worst line excess ≥ ${r.worstExcessGteBp / 100} points.`);
      if (r.blendedExcessGteBp !== null && blended >= r.blendedExcessGteBp)
        reasons.push(`Blended excess ≥ ${r.blendedExcessGteBp / 100} points.`);
      if (
        r.overallExcessGteBp !== null &&
        overallExcess !== null &&
        overallExcess >= r.overallExcessGteBp
      )
        reasons.push(`Overall excess ≥ ${r.overallExcessGteBp / 100} points.`);
      return reasons.length
        ? [{ level: r.level, label: r.label, reasons }]
        : [];
    });
    buckets.push({
      cycle,
      worstExcessBp: worst,
      blendedExcessBp: blended,
      overallDiscountBp: overall,
      overallExcessBp: overallExcess,
      firedRules,
      requiredLevel: Math.max(0, ...firedRules.map((r) => r.level)),
    });
  }
  const requiredLevel = Math.max(0, ...buckets.map((b) => b.requiredLevel));
  return {
    lines,
    buckets,
    requiredLevel,
    route: p.reviewerChain.slice(0, requiredLevel),
    explanations: buckets.flatMap((b) =>
      b.firedRules.flatMap((r) =>
        r.reasons.map((reason) => `${b.cycle}: ${reason}`),
      ),
    ),
  };
}
export const evaluateDiscountRisk = simulateDiscountRisk;
