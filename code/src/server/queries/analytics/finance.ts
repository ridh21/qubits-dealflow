import type { Prisma } from "@prisma/client";
import type { AnalyticsContext } from "./context";
import { month } from "./context";
import { seriesRows, type AnalyticsChart } from "@/domain/analytics/charts";
import { arAging, mrr } from "@/domain/reports/kpis";
export async function financeCharts({
  db,
  scope,
  filters,
  period,
  now,
}: AnalyticsContext): Promise<AnalyticsChart[]> {
  // Standalone invoices are visible to finance/admin unless a quotation-only dimension is selected.
  const quoteDimension =
    filters.teamId ||
    filters.ownerId ||
    filters.productId ||
    filters.categoryId ||
    filters.cycle ||
    filters.approvalStatus !== "ALL";
  const access: Prisma.InvoiceWhereInput = quoteDimension
    ? { order: { quotation: scope } }
    : {
        OR: [
          { order: { quotation: scope } },
          {
            orderId: null,
            customerId: filters.customerId,
            customer: filters.tier ? { tier: filters.tier } : undefined,
          },
        ],
      };
  const [invoices, payments, outstanding, subscriptions, transitions] =
    await Promise.all([
      db.invoice.findMany({
        where: {
          AND: [
            access,
            { status: "ISSUED", issuedAt: { gte: period.from, lt: period.to } },
          ],
        },
      }),
      db.payment.findMany({
        where: {
          paidAt: { gte: period.from, lt: period.to },
          invoice: { AND: [access, { status: "ISSUED" }] },
        },
        include: { invoice: { select: { currency: true } } },
      }),
      db.invoice.findMany({
        where: { AND: [access, { status: "ISSUED", issuedAt: { lte: now } }] },
      }),
      db.subscription.findMany({
        where: { order: { quotation: scope } },
        include: {
          plan: { select: { interval: true } },
          order: { select: { currency: true } },
        },
      }),
      db.subscriptionTransition.findMany({
        where: {
          effectiveAt: { gte: period.from, lt: period.to },
          type: { in: ["PAUSED", "CANCELLED"] },
          subscription: { order: { quotation: scope } },
        },
      }),
    ]);
  const currencies = [
    ...new Set([
      ...invoices.map((i) => i.currency),
      ...outstanding.map((i) => i.currency),
      ...payments.map((p) => p.invoice.currency),
      ...subscriptions.map((s) => s.order.currency),
    ]),
  ].sort();
  const charts: AnalyticsChart[] = [];
  for (const currency of currencies) {
    const issued = invoices.filter((i) => i.currency === currency),
      open = outstanding.filter((i) => i.currency === currency),
      cash = payments.filter((p) => p.invoice.currency === currency);
    charts.push({
      id: `revenue-${currency}`,
      title: `Invoiced revenue · ${currency}`,
      question: "How much was invoiced each month, before credit notes?",
      kind: "area",
      stacked: true,
      dimension: "Invoice month (UTC)",
      unit: currency,
      series: [
        { key: "oneTime", label: "One-time & service" },
        { key: "recurring", label: "Recurring" },
        { key: "proration", label: "Proration" },
      ],
      rows: seriesRows({
        oneTime: issued
          .filter((i) => ["ONE_TIME", "SERVICE"].includes(i.type))
          .map((i) => ({
            label: month(i.issuedAt),
            value: i.totalMinor / 100,
          })),
        recurring: issued
          .filter((i) => i.type === "RECURRING")
          .map((i) => ({
            label: month(i.issuedAt),
            value: i.totalMinor / 100,
          })),
        proration: issued
          .filter((i) => i.type === "PRORATION")
          .map((i) => ({
            label: month(i.issuedAt),
            value: i.totalMinor / 100,
          })),
      }),
    });
    charts.push({
      id: `cash-${currency}`,
      title: `Cash collected and invoiced · ${currency}`,
      question:
        "How do payments received during this period compare with invoices issued? Payments include older invoices.",
      kind: "combo",
      dimension: "Month (UTC)",
      unit: currency,
      series: [
        { key: "invoiced", label: "Invoiced" },
        { key: "cash", label: "Cash received" },
      ],
      rows: seriesRows({
        invoiced: issued.map((i) => ({
          label: month(i.issuedAt),
          value: i.totalMinor / 100,
        })),
        cash: cash.map((p) => ({
          label: month(p.paidAt),
          value: p.amountMinor / 100,
        })),
      }),
    });
    charts.push({
      id: `aging-${currency}`,
      title: `Current receivables aging · ${currency}`,
      question:
        "What remains unpaid today? Includes all matching issued invoices, regardless of the period filter.",
      kind: "bar",
      dimension: "Days overdue today",
      unit: currency,
      series: [{ key: "value", label: "Outstanding balance" }],
      rows: Object.entries(arAging(open, now)).map(([label, value]) => ({
        label,
        value: value / 100,
      })),
    });
    charts.push({
      id: `payment-status-${currency}`,
      title: `Invoice settlement · ${currency}`,
      question:
        "What is today’s settlement status of invoices issued in the selected period?",
      kind: "donut",
      dimension: "Settlement status",
      unit: "Invoices",
      series: [{ key: "value", label: "Invoices" }],
      rows: [
        {
          label: "Settled",
          value: issued.filter(
            (i) => i.paidMinor + i.creditAppliedMinor >= i.totalMinor,
          ).length,
        },
        {
          label: "Partially settled",
          value: issued.filter(
            (i) =>
              i.paidMinor + i.creditAppliedMinor > 0 &&
              i.paidMinor + i.creditAppliedMinor < i.totalMinor,
          ).length,
        },
        {
          label: "Unpaid",
          value: issued.filter(
            (i) => i.totalMinor > 0 && i.paidMinor + i.creditAppliedMinor === 0,
          ).length,
        },
      ],
    });
    charts.push({
      id: `mrr-${currency}`,
      title: `Current normalised MRR · ${currency}`,
      question:
        "What is the monthly equivalent of currently active subscription charges? This current snapshot is independent of the period filter.",
      kind: "bar",
      dimension: "Billing interval",
      unit: `${currency} / month`,
      series: [{ key: "value", label: "Normalised MRR" }],
      rows: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((label) => ({
        label,
        value:
          mrr(
            subscriptions
              .filter(
                (s) =>
                  s.order.currency === currency && s.plan.interval === label,
              )
              .map((s) => ({ ...s, interval: s.plan.interval })),
          ) / 100,
      })),
    });
  }
  charts.push({
    id: "subscription-events",
    title: "Subscription pauses and cancellations",
    question: "How many pauses and cancellations took effect each month?",
    kind: "bar",
    dimension: "Effective month (UTC)",
    unit: "Transitions",
    series: [
      { key: "paused", label: "Paused" },
      { key: "cancelled", label: "Cancelled" },
    ],
    rows: seriesRows({
      paused: transitions
        .filter((t) => t.type === "PAUSED")
        .map((t) => ({ label: month(t.effectiveAt), value: 1 })),
      cancelled: transitions
        .filter((t) => t.type === "CANCELLED")
        .map((t) => ({ label: month(t.effectiveAt), value: 1 })),
    }),
  });
  return charts;
}
