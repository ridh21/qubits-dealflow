import { describe, expect, it } from "vitest";
import {
  alertHeatmap,
  daysSalesOutstanding,
  pipelineMilestones,
  allowedViews,
  analyticsView,
  percentage,
  percentiles,
  seriesRows,
} from "./charts";
describe("analytics access and aggregation", () => {
  it("groups alert dates by UTC day and Monday week across year boundaries", () => {
    expect(alertHeatmap([
      new Date("2026-01-05T00:00:00Z"),
      new Date("2026-01-04T23:59:59Z"),
      new Date("2026-01-05T01:00:00+02:00"),
    ])).toEqual([
      { label: "2026-01-04", value: 2, day: "Sun", week: "2025-12-29" },
      { label: "2026-01-05", value: 1, day: "Mon", week: "2026-01-05" },
    ]);
    expect(alertHeatmap([])).toEqual([]);
  });
  it("counts reached pipeline milestones cumulatively, including prior progress", () => {
    expect(
      pipelineMilestones([
        { submitted: false, approved: false, sent: false, confirmed: false },
        { submitted: true, approved: true, sent: false, confirmed: false },
        { submitted: false, approved: false, sent: false, confirmed: true },
      ]).map((r) => r.value),
    ).toEqual([3, 2, 2, 1, 1]);
  });
  it("calculates DSO only when sales provide a meaningful denominator", () => {
    expect(daysSalesOutstanding(14000, 7000, 30)).toBe(60);
    expect(daysSalesOutstanding(5000, 0, 30)).toBeNull();
    expect(daysSalesOutstanding(-10, 7000, 30)).toBe(0);
  });
  it("rejects forged role views instead of silently exposing another dashboard", () => {
    expect(allowedViews("SALES_REP")).toEqual(["rep"]);
    expect(allowedViews("SALES_MANAGER")).toEqual(["rep", "manager"]);
    expect(allowedViews("FINANCE")).toEqual(["finance", "ops"]);
    expect(() => analyticsView("SALES_REP", "finance")).toThrow();
    expect(() => analyticsView("FINANCE", "admin")).toThrow();
    expect(() => analyticsView("CUSTOMER")).toThrow();
    expect(() => analyticsView("ADMIN", "unknown")).toThrow();
  });
  it("aligns sparse time series without losing repeated entries", () => {
    expect(
      seriesRows({
        invoiced: [
          { label: "2026-09", value: 40 },
          { label: "2026-09", value: 60 },
        ],
        cash: [{ label: "2026-08", value: 15 }],
      }),
    ).toEqual([
      { label: "2026-08", invoiced: 0, cash: 15 },
      { label: "2026-09", invoiced: 100, cash: 0 },
    ]);
  });
  it("uses observed nearest-rank lead times and excludes nonfinite observations", () => {
    expect(percentiles([8, 2, 4, 1, NaN]).map((r) => r.value)).toEqual([
      2, 4, 8, 8,
    ]);
  });
  it("handles empty denominators and preserves negative margin percentages", () => {
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(1, 3)).toBe(33.33);
    expect(percentage(-20, 100)).toBe(-20);
  });
});
