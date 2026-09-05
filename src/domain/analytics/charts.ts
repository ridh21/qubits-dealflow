import { Forbidden } from "@/domain/errors";
export const VIEWS = ["rep", "manager", "finance", "ops", "admin"] as const;
export type AnalyticsView = (typeof VIEWS)[number];
export function allowedViews(role: string): AnalyticsView[] {
  switch (role) {
    case "ADMIN":
      return [...VIEWS];
    case "SALES_MANAGER":
      return ["rep", "manager"];
    case "FINANCE":
      return ["finance", "ops"];
    case "SALES_REP":
      return ["rep"];
    default:
      return [];
  }
}
export function analyticsView(role: string, requested?: string): AnalyticsView {
  const allowed = allowedViews(role);
  const selected = requested ?? allowed[0];
  if (!allowed.includes(selected as AnalyticsView)) throw new Forbidden();
  return selected as AnalyticsView;
}
export interface ChartSeries {
  key: string;
  label: string;
}
export interface AnalyticsChart {
  id: string;
  title: string;
  question: string;
  kind:
    | "bar"
    | "horizontal"
    | "line"
    | "area"
    | "donut"
    | "combo"
    | "scatter"
    | "radial"
    | "funnel"
    | "heatmap";
  unit: string;
  dimension: string;
  rows: { label: string; [key: string]: string | number }[];
  series: ChartSeries[];
  stacked?: boolean;
  maximum?: number;
  reference?: { value: number; label: string };
}
export function percentage(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10000) / 100
    : 0;
}
/** Nearest-rank percentiles keep observed lead times instead of interpolating dates. */
export function percentiles(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return [50, 75, 90, 95].map((p) => ({
    label: `P${p}`,
    value: sorted.length ? sorted[Math.ceil((p / 100) * sorted.length) - 1] : 0,
  }));
}
export function seriesRows(
  groups: Record<string, { label: string; value: number }[]>,
) {
  const labels = new Set<string>();
  const totals = Object.fromEntries(
    Object.entries(groups).map(([key, rows]) => {
      const sums = new Map<string, number>();
      for (const row of rows) {
        labels.add(row.label);
        sums.set(row.label, (sums.get(row.label) ?? 0) + row.value);
      }
      return [key, sums];
    }),
  );
  return [...labels].sort().map((label) => ({
    label,
    ...Object.fromEntries(
      Object.entries(totals).map(([key, sums]) => [key, sums.get(label) ?? 0]),
    ),
  }));
}
/** Gross invoice DSO uses the receivable balance and invoiced sales in one currency. */
export function daysSalesOutstanding(
  balanceMinor: number,
  salesMinor: number,
  periodDays: number,
) {
  if (salesMinor <= 0 || periodDays <= 0) return null;
  return (
    Math.round((Math.max(0, balanceMinor) / salesMinor) * periodDays * 100) /
    100
  );
}

export function pipelineMilestones(
  quotes: {
    submitted: boolean;
    approved: boolean;
    sent: boolean;
    confirmed: boolean;
  }[],
) {
  return [
    { label: "Created", value: quotes.length },
    {
      label: "Submitted",
      value: quotes.filter(
        (q) => q.submitted || q.approved || q.sent || q.confirmed,
      ).length,
    },
    {
      label: "Approved",
      value: quotes.filter((q) => q.approved || q.sent || q.confirmed).length,
    },
    {
      label: "Sent",
      value: quotes.filter((q) => q.sent || q.confirmed).length,
    },
    { label: "Confirmed", value: quotes.filter((q) => q.confirmed).length },
  ];
}

/** Sparse UTC calendar cells: each represented week keeps its actual date label. */
export function alertHeatmap(dates: Date[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const label = date.toISOString().slice(0, 10);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => {
      const date = new Date(`${label}T00:00:00Z`),
        weekday = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - weekday);
      return {
        label,
        value,
        day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday],
        week: date.toISOString().slice(0, 10),
      };
    });
}
