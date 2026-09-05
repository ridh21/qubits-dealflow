/**
 * Money is always integer minor units (cents). Percentages are basis points:
 * 1250 bp = 12.50 %. Nothing in the app stores a float amount.
 */
export const BP_SCALE = 10_000;

export function pctOf(amountMinor: number, bp: number): number {
  return Math.round((amountMinor * bp) / BP_SCALE);
}

export function applyDiscount(amountMinor: number, bp: number): number {
  return amountMinor - pctOf(amountMinor, bp);
}

export function ratioBp(partMinor: number, wholeMinor: number): number {
  if (wholeMinor === 0) return 0;
  return Math.round((partMinor * BP_SCALE) / wholeMinor);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Split `totalMinor` across `weights` so the parts always add back up to the
 * total. Largest-remainder method; ties go to the lower index, which makes the
 * result deterministic for the same inputs (required for allocated order
 * discounts, proration and credits).
 */
export function allocateProportional(totalMinor: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const totalWeight = sum(weights);
  if (totalWeight <= 0) {
    // No weight to distribute against: everything lands on the first slot.
    const out = new Array<number>(n).fill(0);
    out[0] = totalMinor;
    return out;
  }

  const exact = weights.map((w) => (totalMinor * w) / totalWeight);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = totalMinor - sum(floors);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac === a.frac ? a.i - b.i : b.frac - a.frac));

  const out = [...floors];
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    out[order[k].i] += 1;
  }
  // Negative totals (credits) push the remainder the other way.
  for (let k = 0; remainder < 0 && k < order.length; k++, remainder++) {
    out[order[order.length - 1 - k].i] -= 1;
  }
  return out;
}

export function formatMinor(amountMinor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatBp(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

export function parseMoneyToMinor(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
