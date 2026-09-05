import Decimal from "decimal.js";
import { DAY_MS, type HealthFinding } from "./types";
export interface DiscountHistory {
  ownerId: string;
  submittedAt: Date;
  effectiveDiscountBp: number;
}
export function repBaseline(
  history: DiscountHistory[],
  ownerId: string,
  now: Date,
  lookbackDays: number,
) {
  const oldest = now.getTime() - lookbackDays * DAY_MS;
  const samples = history.filter(
    (h) =>
      h.ownerId === ownerId &&
      h.submittedAt.getTime() >= oldest &&
      h.submittedAt < now,
  );
  const sum = samples.reduce(
    (s, h) => s.plus(h.effectiveDiscountBp),
    new Decimal(0),
  );
  return {
    mean: samples.length ? sum.div(samples.length).toNumber() : 0,
    n: samples.length,
  };
}
export function detectDiscountAnomaly(
  quote: {
    id: string;
    overallDiscountBp: number;
    worstLine?: { label: string; effectiveDiscountBp: number };
  },
  baseline: { mean: number; n: number },
  cfg: { minDeltaBp: number; minSamples: number },
): {
  alert: HealthFinding | null;
  reason: "INSUFFICIENT_HISTORY" | "WITHIN_BASELINE" | "ANOMALY";
} {
  if (baseline.n < cfg.minSamples)
    return { alert: null, reason: "INSUFFICIENT_HISTORY" };
  const delta = quote.overallDiscountBp - baseline.mean;
  if (delta < cfg.minDeltaBp) return { alert: null, reason: "WITHIN_BASELINE" };
  return {
    reason: "ANOMALY",
    alert: {
      type: "DISCOUNT_ANOMALY",
      quotationId: quote.id,
      severity: delta >= 2 * cfg.minDeltaBp ? "HIGH" : "MEDIUM",
      detail: {
        label: `Discount ${quote.overallDiscountBp / 100}% vs average ${(baseline.mean / 100).toFixed(2)}% (n=${baseline.n})`,
        givenBp: quote.overallDiscountBp,
        meanBp: baseline.mean,
        n: baseline.n,
        worstLine: quote.worstLine?.label ?? null,
      },
    },
  };
}
