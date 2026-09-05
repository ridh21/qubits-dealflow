import type { AnalyticsContext } from "./context";
import { month } from "./context";
import {
  percentage,
  percentiles,
  seriesRows,
  type AnalyticsChart,
} from "@/domain/analytics/charts";
export async function opsCharts({
  db,
  scope,
  period,
}: AnalyticsContext): Promise<AnalyticsChart[]> {
  const [shipments, orders, stock, backorders] = await Promise.all([
    db.shipment.findMany({
      where: {
        status: "SHIPPED",
        shippedAt: { gte: period.from, lt: period.to },
        order: { quotation: scope },
      },
      include: {
        warehouse: { select: { name: true } },
        order: { select: { confirmedAt: true, promisedDeliveryDate: true } },
      },
    }),
    db.order.findMany({
      where: {
        quotation: scope,
        confirmedAt: { gte: period.from, lt: period.to },
      },
      include: {
        lines: {
          select: { backorders: { select: { id: true, status: true } } },
        },
      },
    }),
    db.stockLevel.findMany({
      include: { warehouse: { select: { name: true } } },
    }),
    db.backorder.findMany({
      where: { orderLine: { order: { quotation: scope } } },
      select: { id: true },
    }),
  ]);
  const consolidations = backorders.length
    ? await db.auditLog.findMany({
        where: {
          entityType: "Backorder",
          entityId: { in: backorders.map((b) => b.id) },
          action: "BACKORDER.CONSOLIDATED",
          createdAt: { gte: period.from, lt: period.to },
        },
        select: { createdAt: true },
      })
    : [];
  const dated = shipments.filter((s) => !!s.order.promisedDeliveryDate);
  return [
    {
      id: "consolidations",
      title: "Backorder consolidation events",
      question:
        "How many backorder consolidation actions were recorded each month for matching orders?",
      kind: "bar",
      dimension: "Action month (IST)",
      unit: "Actions",
      series: [{ key: "value", label: "Consolidations" }],
      rows: seriesRows({
        value: consolidations.map((c) => ({
          label: month(c.createdAt),
          value: 1,
        })),
      }),
    },
    {
      id: "lead-time",
      title: "Dispatch lead-time percentiles",
      question:
        "How many days elapsed between order confirmation and each shipment? Partial shipments count separately.",
      kind: "bar",
      dimension: "Nearest-rank percentile",
      unit: "Days",
      series: [{ key: "value", label: "Days to dispatch" }],
      rows: shipments.length
        ? percentiles(
            shipments.flatMap((s) =>
              s.shippedAt && s.shippedAt >= s.order.confirmedAt
                ? [
                    (s.shippedAt.getTime() - s.order.confirmedAt.getTime()) /
                      86400000,
                  ]
                : [],
            ),
          )
        : [],
    },
    {
      id: "backorders",
      title: "Orders with backorders",
      question:
        "What share of each confirmation cohort has ever had a backorder?",
      kind: "line",
      dimension: "Confirmation month (IST)",
      unit: "% of orders",
      series: [{ key: "value", label: "Backorder rate" }],
      rows: [...new Set(orders.map((o) => month(o.confirmedAt)))]
        .sort()
        .map((label) => {
          const cohort = orders.filter((o) => month(o.confirmedAt) === label);
          return {
            label,
            value: percentage(
              cohort.filter((o) => o.lines.some((l) => l.backorders.length))
                .length,
              cohort.length,
            ),
          };
        }),
    },
    {
      id: "warehouses",
      title: "Shipments by warehouse",
      question: "Which warehouses dispatched shipments during this period?",
      kind: "donut",
      dimension: "Warehouse",
      unit: "Shipments",
      series: [{ key: "value", label: "Shipments" }],
      rows: seriesRows({
        value: shipments.map((s) => ({ label: s.warehouse.name, value: 1 })),
      }),
    },
    {
      id: "stock",
      title: "Current stock health",
      question:
        "How much stock is reserved or available per warehouse now? Their sum is on-hand stock. Inventory is global and independent of team and period filters.",
      kind: "bar",
      stacked: true,
      dimension: "Warehouse",
      unit: "Units",
      series: [
        { key: "reserved", label: "Reserved" },
        { key: "available", label: "Available" },
      ],
      rows: seriesRows({
        reserved: stock.map((s) => ({
          label: s.warehouse.name,
          value: s.reserved,
        })),
        available: stock.map((s) => ({
          label: s.warehouse.name,
          value: s.onHand - s.reserved,
        })),
      }),
    },
    {
      id: "promise",
      title: "Dispatch versus promised delivery date",
      question:
        "Were shipments dispatched by the promised date? This measures dispatch, not arrival. Undated orders are excluded.",
      kind: "donut",
      dimension: "Dispatch timing",
      unit: "Shipments",
      series: [{ key: "value", label: "Shipments" }],
      rows: [
        {
          label: "By promise date",
          value: dated.filter(
            (s) => s.shippedAt! <= s.order.promisedDeliveryDate!,
          ).length,
        },
        {
          label: "After promise date",
          value: dated.filter(
            (s) => s.shippedAt! > s.order.promisedDeliveryDate!,
          ).length,
        },
      ],
    },
  ];
}
