import { describe, it, expect } from "vitest";
import {
  avgApprovalHours,
  conversion,
  discountByRep,
  bucketByPeriod,
  arAging,
  mrr,
  churnAndPause,
} from "./kpis";
describe("report calculations", () => {
  it("excludes unfinished approvals and empty rates", () => {
    expect(
      avgApprovalHours([
        {
          role: "MANAGER",
          startedAt: new Date("2026-09-01"),
          decidedAt: new Date("2026-09-02"),
        },
        { role: "FINANCE", startedAt: new Date("2026-09-02"), decidedAt: null },
      ]),
    ).toEqual({ overall: 24, byRole: { MANAGER: 24, FINANCE: null } });
    expect(conversion([]).rate).toBe(0);
  });
  it("weights discount by value, not number of lines", () => {
    expect(
      discountByRep([
        { ownerId: "r", grossMinor: 100, discountMinor: 50 },
        { ownerId: "r", grossMinor: 900, discountMinor: 90 },
      ])[0].discountBp,
    ).toBe(1400);
  });
  it("uses UTC Monday week starts across a year boundary", () => {
    expect(
      bucketByPeriod([{ date: new Date("2026-01-01"), value: 4 }], "week"),
    ).toEqual([{ date: "2025-12-29", value: 4 }]);
  });
  it("ages only outstanding issued amounts", () => {
    const now = new Date("2026-09-01");
    const row = {
      dueAt: new Date("2026-08-01"),
      totalMinor: 1000,
      paidMinor: 300,
      creditAppliedMinor: 200,
      status: "ISSUED",
    };
    expect(arAging([row, { ...row, status: "VOID" }], now)["31–60"]).toBe(500);
  });
  it("normalises cycles and excludes paused subscriptions", () => {
    const s = {
      qty: 1,
      unitPriceMinor: 12000,
      discountBp: 0,
      status: "ACTIVE",
    };
    expect(
      mrr([
        { ...s, interval: "YEARLY" },
        { ...s, interval: "QUARTERLY" },
        { ...s, interval: "MONTHLY", status: "PAUSED" },
      ]),
    ).toBe(5000);
  });
  it("uses a half-open reporting period for churn", () => {
    expect(
      churnAndPause(
        [
          {
            activationDate: new Date("2026-01-01"),
            cancelledAt: new Date("2026-10-01"),
            pauseEffectiveAt: new Date("2026-09-01"),
          },
        ],
        { from: new Date("2026-09-01"), to: new Date("2026-10-01") },
      ),
    ).toEqual({ opening: 1, cancelled: 0, paused: 1, churnRate: 0 });
  });
});
