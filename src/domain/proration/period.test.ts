import { describe, expect, it } from "vitest";
import { clampToMonthDay, nextPeriod, periodDays, periodEnd } from "./period";

const date = (value: string) => new Date(`${value}T00:00:00Z`);

describe("billing periods", () => {
  it("counts actual days and preserves inputs", () => {
    const start = date("2026-09-15");
    expect(periodEnd("MONTHLY", start)).toEqual(date("2026-10-15"));
    expect(periodDays(start, date("2026-10-15"))).toBe(30);
    expect(start).toEqual(date("2026-09-15"));
    expect(periodEnd("WEEKLY", start)).toEqual(date("2026-09-22"));
  });
  it("preserves Jan 31 across February", () => {
    const feb = periodEnd("MONTHLY", date("2027-01-31"));
    expect(feb).toEqual(date("2027-02-28"));
    expect(nextPeriod("MONTHLY", feb, 31)).toEqual({
      start: feb,
      end: date("2027-03-31"),
    });
  });
  it("returns to leap day after three non-leap years", () => {
    let start = date("2028-02-29");
    for (const year of [2029, 2030, 2031, 2032]) {
      start = nextPeriod("YEARLY", start, 29).end;
      expect(start).toEqual(date(`${year}-02-${year === 2032 ? 29 : 28}`));
    }
  });
  it("preserves quarterly anchors and UTC time", () => {
    const feb = periodEnd("QUARTERLY", date("2026-11-30"));
    expect(feb).toEqual(date("2027-02-28"));
    expect(nextPeriod("QUARTERLY", feb, 30).end).toEqual(date("2027-05-30"));
    expect(
      periodEnd("MONTHLY", new Date("2026-01-31T13:14:15.123Z")).toISOString(),
    ).toBe("2026-02-28T13:14:15.123Z");
    expect(clampToMonthDay(2028, 1, 31)).toEqual(date("2028-02-29"));
  });
  it("rejects invalid dates, anchors and empty periods", () => {
    expect(() => periodDays(date("2026-01-01"), date("2026-01-01"))).toThrow();
    expect(() => periodEnd("MONTHLY", new Date(NaN))).toThrow();
    expect(() => clampToMonthDay(2026, 1, 0)).toThrow();
  });
});
