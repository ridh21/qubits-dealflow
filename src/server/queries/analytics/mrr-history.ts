import { recurringPriceBasis } from "@/domain/proration/prorate";
import type { AnalyticsChart } from "@/domain/analytics/charts";
import { reconstructMrrHistory } from "@/domain/analytics/mrr-history";
import type { AnalyticsContext } from "./context";

/** Finance can append these currency-separated charts to its existing result. */
export async function mrrHistoryCharts({
  db,
  scope,
  period,
  now,
}: AnalyticsContext): Promise<AnalyticsChart[]> {
  // Include earlier events to establish opening state and later events up to now
  // to reconcile against current mutable fields. Do not filter by report start.
  const subscriptions = await db.subscription.findMany({
    where: { order: { quotation: scope } },
    include: {
      order: { select: { currency: true } },
      orderLine: {
        select: {
          netMinor: true,
          qty: true,
          unitPriceMinor: true,
          discountBp: true,
          planId: true,
          interval: true,
        },
      },
      transitions: {
        where: { effectiveAt: { lte: now } },
        orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  const planIds = new Set<string>();
  for (const subscription of subscriptions) {
    for (const event of subscription.transitions) {
      if (!["QTY_CHANGED", "PLAN_CHANGED"].includes(event.type)) continue;
      const detail = event.detail;
      if (
        detail &&
        typeof detail === "object" &&
        !Array.isArray(detail) &&
        detail.pending === false &&
        typeof detail.newPlanId === "string"
      )
        planIds.add(detail.newPlanId);
    }
  }
  // Catalog service never changes interval for an existing ID. Include inactive
  // plans; today's catalog prices must never substitute for event prices.
  const plans = planIds.size
    ? await db.subscriptionPlan.findMany({
        where: { id: { in: [...planIds] } },
        select: { id: true, interval: true },
      })
    : [];
  const intervals = new Map(plans.map((plan) => [plan.id, plan.interval]));
  const currencies = [
    ...new Set(subscriptions.map((s) => s.order.currency)),
  ].sort();
  return (currencies.length ? currencies : [null]).map((currency) => {
    const history = reconstructMrrHistory(
      subscriptions
        .filter((s) => s.order.currency === currency)
        .map((s) => ({
          ...s,
          orderLine: {
            ...s.orderLine,
            pricingBasis: recurringPriceBasis(s.orderLine),
          },
        })),
      intervals,
      period,
      now,
    );
    return {
      id: currency ? `mrr-history-${currency}` : "mrr-history",
      title: `Historical normalised MRR${currency ? ` · ${currency}` : ""}`,
      question:
        history.incompleteReason ??
        (currency === null
          ? "No subscriptions match the selected scope."
          : "Monthly as-of recurring charges, net of discount and before tax; weekly × 52/12, quarterly ÷ 3, yearly ÷ 12. UTC month ends are clipped to the selected exclusive period end and now. Pending changes are excluded."),
      kind: "line",
      dimension: "As-of month (IST)",
      unit: currency ? `${currency} / month` : "MRR",
      series: [{ key: "value", label: "Normalised MRR" }],
      rows: history.rows.map((row) => ({
        label: row.label,
        asOf: row.asOf,
        value: row.valueMinor / 100,
      })),
    };
  });
}
