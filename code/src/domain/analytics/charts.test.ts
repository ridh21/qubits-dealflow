import { describe, expect, it } from "vitest";
import {
  daysSalesOutstanding,
  allowedViews,
  analyticsView,
  percentage,
  percentiles,
  seriesRows,
} from "./charts";
describe("analytics access and aggregation", () => {
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
