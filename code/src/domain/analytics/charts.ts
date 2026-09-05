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
  kind: "bar" | "horizontal" | "line" | "area" | "donut" | "combo" | "scatter";
  unit: string;
  dimension: string;
  rows: { label: string; [key: string]: string | number }[];
  series: ChartSeries[];
  stacked?: boolean;
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
