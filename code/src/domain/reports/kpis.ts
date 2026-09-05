import Decimal from "decimal.js";
import {
  periodAmount,
  type RecurringPriceBasis,
} from "@/domain/proration/prorate";
import type { Interval } from "@/domain/proration/period";
const DAY = 86400000;
export function avgApprovalHours(
  steps: { role: string; startedAt: Date; decidedAt: Date | null }[],
) {
  const completed = steps.filter(
    (s): s is typeof s & { decidedAt: Date } =>
      !!s.decidedAt && s.decidedAt >= s.startedAt,
  );
  const average = (rows: typeof completed) =>
    rows.length
      ? rows.reduce(
          (n, s) =>
            n + (s.decidedAt.getTime() - s.startedAt.getTime()) / 3600000,
          0,
        ) / rows.length
      : null;
  return {
    overall: average(completed),
    byRole: Object.fromEntries(
      [...new Set(steps.map((s) => s.role))].map((role) => [
        role,
        average(completed.filter((s) => s.role === role)),
      ]),
    ),
  };
}
export function conversion(quotes: { status: string }[]) {
  const confirmed = quotes.filter((q) => q.status === "CONFIRMED").length;
  return {
    total: quotes.length,
    confirmed,
    rate: quotes.length ? confirmed / quotes.length : 0,
  };
}
export function discountByRep(
  lines: { ownerId: string; grossMinor: number; discountMinor: number }[],
) {
  const groups = new Map<
    string,
    { ownerId: string; grossMinor: number; discountMinor: number }
  >();
  for (const line of lines) {
    const group = groups.get(line.ownerId) ?? {
      ownerId: line.ownerId,
      grossMinor: 0,
      discountMinor: 0,
    };
    group.grossMinor += line.grossMinor;
    group.discountMinor += line.discountMinor;
    groups.set(line.ownerId, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    discountBp: g.grossMinor
      ? new Decimal(g.discountMinor)
          .div(g.grossMinor)
          .mul(10000)
          .round()
          .toNumber()
      : 0,
  }));
}
export function topUpsold(
  lines: {
    productId: string;
    productName: string;
    qty: number;
    netMinor: number;
    addedFromUpsell: boolean;
  }[],
) {
  const grouped = new Map<
    string,
    { productId: string; productName: string; qty: number; netMinor: number }
  >();
  for (const l of lines.filter((l) => l.addedFromUpsell)) {
    const g = grouped.get(l.productId) ?? {
      productId: l.productId,
      productName: l.productName,
      qty: 0,
      netMinor: 0,
    };
    g.qty += l.qty;
    g.netMinor += l.netMinor;
    grouped.set(l.productId, g);
  }
  return [...grouped.values()].sort(
    (a, b) => b.netMinor - a.netMinor || a.productId.localeCompare(b.productId),
  );
}
export function bucketByPeriod(
  rows: { date: Date; value: number }[],
  period: "day" | "week" | "month",
) {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const date = new Date(row.date);
    date.setUTCHours(0, 0, 0, 0);
    if (period === "month") date.setUTCDate(1);
    if (period === "week")
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + row.value);
  }
  return [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
export function arAging(
  invoices: {
    dueAt: Date;
    totalMinor: number;
    paidMinor: number;
    creditAppliedMinor: number;
    status: string;
  }[],
  now: Date,
) {
  const buckets = { current: 0, "0–30": 0, "31–60": 0, "61–90": 0, "90+": 0 };
  for (const i of invoices) {
    if (i.status !== "ISSUED") continue;
    const balance = Math.max(
      0,
      i.totalMinor - i.paidMinor - i.creditAppliedMinor,
    );
    const days = Math.floor((now.getTime() - i.dueAt.getTime()) / DAY);
    const key =
      i.dueAt >= now
        ? "current"
        : days <= 30
          ? "0–30"
          : days <= 60
            ? "31–60"
            : days <= 90
              ? "61–90"
              : "90+";
    buckets[key] += balance;
  }
  return buckets;
}
/** Normalised monthly recurring revenue, not a prediction of invoice timing. */
export function mrr(
  subscriptions: {
    status: string;
    qty: number;
    unitPriceMinor: number;
    discountBp: number;
    interval: Interval;
    pricingBasis?: RecurringPriceBasis;
  }[],
) {
  const factors = {
    WEEKLY: new Decimal(52).div(12),
    MONTHLY: new Decimal(1),
    QUARTERLY: new Decimal(1).div(3),
    YEARLY: new Decimal(1).div(12),
  };
  return subscriptions
    .filter((s) => ["ACTIVE", "PAUSE_SCHEDULED"].includes(s.status))
    .reduce(
      (total, s) =>
        total.plus(
          new Decimal(
            periodAmount(s.qty, s.unitPriceMinor, s.discountBp, s.pricingBasis),
          ).mul(factors[s.interval]),
        ),
      new Decimal(0),
    )
    .round()
    .toNumber();
}
export function churnAndPause(
  subs: {
    activationDate: Date;
    cancelledAt: Date | null;
    pauseEffectiveAt: Date | null;
  }[],
  period: { from: Date; to: Date },
) {
  const inPeriod = (date: Date | null) =>
    !!date && date >= period.from && date < period.to;
  const opening = subs.filter(
    (s) =>
      s.activationDate < period.from &&
      (!s.cancelledAt || s.cancelledAt >= period.from),
  ).length;
  const cancelled = subs.filter((s) => inPeriod(s.cancelledAt)).length;
  return {
    opening,
    cancelled,
    paused: subs.filter((s) => inPeriod(s.pauseEffectiveAt)).length,
    churnRate: opening ? cancelled / opening : null,
  };
}
