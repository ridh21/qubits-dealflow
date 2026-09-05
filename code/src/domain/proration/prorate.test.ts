import { describe, expect, it } from "vitest";
import {
  cancellation,
  periodAmount,
  planChangeDifferentCycle,
  planChangeSameCycle,
  prorate,
  quantityChange,
} from "./prorate";
const start = new Date("2026-09-01T00:00:00Z");
const end = new Date("2026-10-01T00:00:00Z");
const period = { start, end };
const at = new Date("2026-09-16T00:00:00Z");

describe("proration", () => {
  it.each([
    [6000, 9000, 1500, 150, "CHARGE"],
    [9000, 6000, -1500, -150, "CREDIT"],
  ] as const)(
    "prorates %i to %i",
    (oldPeriodAmount, newPeriodAmount, netMinor, taxMinor, kind) => {
      expect(
        planChangeSameCycle(
          {
            oldPeriodAmount,
            newPeriodAmount,
            taxBp: 1000,
            period,
            rule: "DAILY",
          },
          at,
        ),
      ).toMatchObject({ netMinor, taxMinor, kind });
    },
  );
  it("rounds quantity deltas once, with signed half-up cents", () => {
    expect(
      quantityChange(
        {
          qty: 1,
          unitPriceMinor: 4600,
          discountBp: 0,
          taxBp: 1000,
          period,
          rule: "DAILY",
        },
        3,
        new Date("2026-09-11T00:00:00Z"),
      ),
    ).toMatchObject({ netMinor: 6133, taxMinor: 613 });
    expect(prorate(1, period, at)).toBe(1);
    expect(prorate(-1, period, at)).toBe(-1);
    expect(periodAmount(3, 101, 5000)).toBe(151);
  });
  it("clamps outside the period and charges full delta at start", () => {
    expect(prorate(6000, period, new Date("2026-08-01"))).toBe(6000);
    expect(prorate(6000, period, end)).toBe(0);
    expect(prorate(6000, period, new Date("2027-01-01"))).toBe(0);
    expect(
      planChangeSameCycle(
        {
          oldPeriodAmount: 6000,
          newPeriodAmount: 9000,
          taxBp: 1000,
          period,
          rule: "DAILY",
        },
        start,
      ).netMinor,
    ).toBe(3000);
  });
  it("defers NONE changes", () => {
    expect(
      planChangeSameCycle(
        {
          oldPeriodAmount: 6000,
          newPeriodAmount: 9000,
          taxBp: 1000,
          period,
          rule: "NONE",
        },
        at,
      ),
    ).toMatchObject({ kind: "NONE", netMinor: 0, taxMinor: 0 });
    expect(
      planChangeDifferentCycle(
        {
          oldPeriodAmount: 6000,
          oldPeriod: period,
          newPeriodAmount: 60000,
          newInterval: "YEARLY",
          taxBp: 1000,
          rule: "NONE",
        },
        at,
      ),
    ).toMatchObject({ creditMinor: 0, newPeriod: { start: end } });
  });
  it("credits unused old cycle and resets the new anchor", () => {
    const changeAt = new Date("2026-09-11T00:00:00Z");
    expect(
      planChangeDifferentCycle(
        {
          oldPeriodAmount: 6000,
          oldPeriod: period,
          newPeriodAmount: 60000,
          newInterval: "YEARLY",
          taxBp: 1000,
          rule: "DAILY",
        },
        changeAt,
      ),
    ).toMatchObject({
      creditMinor: 4000,
      chargeMinor: 60000,
      newPeriod: { start: changeAt, end: new Date("2027-09-11T00:00:00Z") },
    });
  });
  it("handles cancellation modes, policy and uninvoiced periods", () => {
    const input = {
      periodAmount: 4600,
      period,
      rule: "PRORATED_CREDIT",
      invoiced: true,
      mode: "IMMEDIATE",
    } as const;
    const changeAt = new Date("2026-09-11T00:00:00Z");
    expect(cancellation(input, changeAt)).toEqual({
      creditMinor: 3067,
      effectiveAt: changeAt,
    });
    expect(cancellation({ ...input, mode: "END_OF_PERIOD" }, changeAt)).toEqual(
      { creditMinor: 0, effectiveAt: end },
    );
    expect(cancellation({ ...input, rule: "NONE" }, changeAt).creditMinor).toBe(
      0,
    );
    expect(
      cancellation({ ...input, rule: "FULL_CREDIT" }, changeAt).creditMinor,
    ).toBe(4600);
    expect(
      cancellation({ ...input, rule: "FULL_CREDIT", invoiced: false }, changeAt)
        .creditMinor,
    ).toBe(0);
  });
});
