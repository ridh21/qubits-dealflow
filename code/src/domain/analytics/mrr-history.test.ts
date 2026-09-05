import { describe, expect, it, vi } from "vitest";
import {
  reconstructMrrHistory,
  type MrrHistorySubscription,
} from "./mrr-history";
import { mrrHistoryCharts } from "@/server/queries/analytics/mrr-history";
import type { AnalyticsContext } from "@/server/queries/analytics/context";
import type { Interval } from "@/domain/proration/period";

const date = (s: string) => new Date(`${s}T00:00:00.000Z`);
const period = { from: date("2026-01-01"), to: date("2026-05-01") };
const now = date("2026-05-15");
const plans = new Map<string, Interval>([
  ["monthly", "MONTHLY"],
  ["yearly", "YEARLY"],
]);
function event(type: string, at: string, detail: unknown = null) {
  return {
    id: `${at}-${type}`,
    type,
    effectiveAt: date(at),
    createdAt: date(at),
    detail,
  };
}
function sub(
  overrides: Partial<MrrHistorySubscription> = {},
): MrrHistorySubscription {
  return {
    id: "s",
    status: "ACTIVE",
    qty: 1,
    unitPriceMinor: 1200,
    discountBp: 0,
    planId: "monthly",
    orderLine: {
      qty: 1,
      unitPriceMinor: 1200,
      discountBp: 0,
      planId: "monthly",
      interval: "MONTHLY",
    },
    transitions: [event("ACTIVATE", "2026-01-01")],
    ...overrides,
  };
}
const values = (s: MrrHistorySubscription[], p = period, at = now) =>
  reconstructMrrHistory(s, plans, p, at).rows.map((r) => r.valueMinor);
const change = (
  newQty: number,
  newPriceMinor = 1200,
  newPlanId = "monthly",
  pending = false,
) => ({ newQty, newPriceMinor, newPlanId, pending });

describe("historical normalized MRR", () => {
  it("preserves accepted allocation cents in historical charges", () => {
    const s = sub({ qty: 1000, unitPriceMinor: 123456, discountBp: 2316 });
    s.orderLine = {
      ...s.orderLine!,
      qty: 1000,
      unitPriceMinor: 123456,
      discountBp: 2316,
      pricingBasis: { grossMinor: 123456000, netMinor: 94866993 },
    };
    expect(values([s])).toEqual([94866993, 94866993, 94866993, 94866993]);
  });
  it("orders activation before its first billed period when transaction timestamps tie", () => {
    const activation = { ...event("ACTIVATE", "2026-01-01"), id: "z" };
    const billed = { ...event("PERIOD_ADVANCED", "2026-01-01"), id: "a" };
    expect(values([sub({ transitions: [billed, activation] })])).toEqual([
      1200, 1200, 1200, 1200,
    ]);
  });
  it.each<[Interval, number]>([
    ["WEEKLY", 4680],
    ["MONTHLY", 1080],
    ["QUARTERLY", 360],
    ["YEARLY", 90],
  ])("normalizes %s after discount", (interval, expected) => {
    const s = sub({ discountBp: 1000 });
    s.orderLine = { ...s.orderLine!, interval, discountBp: 1000 };
    expect(values([s])).toEqual([expected, expected, expected, expected]);
  });
  it("replays qty and historical plan terms, never today's mutated price", () => {
    const s = sub({
      qty: 3,
      unitPriceMinor: 24000,
      planId: "yearly",
      transitions: [
        event("PLAN_CHANGED", "2026-03-01", change(3, 24000, "yearly")),
        event("ACTIVATE", "2026-01-01"),
        event("QTY_CHANGED", "2026-02-01", change(2)),
      ],
    });
    expect(values([s])).toEqual([1200, 2400, 6000, 6000]);
  });
  it("replays repeated pause/resume cycles and cancellation at month boundaries", () => {
    const s = sub({
      status: "CANCELLED",
      transitions: [
        event("ACTIVATE", "2025-11-01"),
        event("PAUSED", "2025-12-01"),
        event("RESUMED", "2026-01-01"),
        event("PAUSED", "2026-02-01"),
        event("RESUMED", "2026-03-01"),
        event("CANCELLED", "2026-04-01"),
      ],
    });
    expect(values([s])).toEqual([1200, 0, 1200, 0]);
  });
  it("ignores requests and overdue pending terms until the job applies them", () => {
    const s = sub({
      status: "PAUSE_SCHEDULED",
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("PAUSE_REQUESTED", "2026-06-01"),
        event("QTY_CHANGED", "2026-02-01", change(8, 1200, "monthly", true)),
        event("CANCEL_REQUESTED", "2026-06-01"),
        event("RESUME_SELECTED", "2026-07-01"),
      ],
    });
    expect(values([s])).toEqual([1200, 1200, 1200, 1200]);
    s.qty = 8;
    s.transitions[2].detail = change(8);
    expect(values([s])).toEqual([1200, 9600, 9600, 9600]);
  });
  it("clips partial months, excludes period.to and includes events exactly at now", () => {
    const s = sub({
      qty: 2,
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("QTY_CHANGED", "2026-03-01", change(2)),
      ],
    });
    expect(
      values([s], { from: date("2026-02-15"), to: date("2026-03-01") }),
    ).toEqual([1200]);
    const result = reconstructMrrHistory(
      [s],
      plans,
      period,
      date("2026-03-01"),
    );
    expect(result.rows.map((r) => r.valueMinor)).toEqual([1200, 1200, 2400]);
    expect(result.rows.at(-1)?.asOf).toBe("2026-03-01T00:00:00.000Z");
    expect(
      values([s], { from: date("2026-06-01"), to: date("2026-07-01") }),
    ).toEqual([]);
  });
  it("uses effectiveAt for late job events and excludes future events", () => {
    const activation = event("ACTIVATE", "2026-01-01");
    activation.createdAt = date("2026-03-01");
    expect(
      values([
        sub({ transitions: [activation, event("CANCELLED", "2026-06-01")] }),
      ]),
    ).toEqual([1200, 1200, 1200, 1200]);
  });
  it("breaks equal effective dates by creation time", () => {
    const first = event("QTY_CHANGED", "2026-02-01", change(2));
    const second = {
      ...event("QTY_CHANGED", "2026-02-01", change(3)),
      createdAt: date("2026-02-02"),
    };
    expect(
      values([
        sub({
          qty: 3,
          transitions: [second, first, event("ACTIVATE", "2026-01-01")],
        }),
      ]),
    ).toEqual([1200, 3600, 3600, 3600]);
  });
  it.each([
    sub({ orderLine: null }),
    sub({ orderLine: { ...sub().orderLine!, interval: null } }),
    sub({ transitions: [] }),
    sub({ qty: 9 }),
    sub({ status: "PAUSED" }),
    sub({
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("QTY_CHANGED", "2026-02-01", { newQty: 2 }),
      ],
    }),
    sub({
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("PLAN_CHANGED", "2026-02-01", change(1, 1200, "deleted")),
      ],
    }),
    sub({
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("RESUMED", "2026-02-01"),
      ],
    }),
    sub({
      status: "CANCELLED",
      transitions: [event("CANCELLED", "2026-02-01")],
    }),
    sub({
      transitions: [
        event("ACTIVATE", "2026-01-01"),
        event("PAUSED", "2026-02-01"),
        event("QTY_CHANGED", "2026-02-02", change(2)),
      ],
    }),
  ])("returns no partial or fabricated chart for missing history (%#)", (s) => {
    const result = reconstructMrrHistory([sub(), s], plans, period, now);
    expect(result.rows).toEqual([]);
    expect(result.incompleteReason).toMatch(/Incomplete subscription history/);
  });
  it("does not infer activation for scheduled subscriptions", () => {
    expect(values([sub({ status: "SCHEDULED", transitions: [] })])).toEqual([
      0, 0, 0, 0,
    ]);
    expect(values([])).toEqual([]);
  });
});

describe("MRR history query", () => {
  it("scopes subscriptions, resolves historical plan IDs and separates currencies", async () => {
    const scoped = { ownerId: "rep-1" };
    const findMany = vi.fn().mockResolvedValue([
      {
        ...sub({
          unitPriceMinor: 24000,
          planId: "yearly",
          transitions: [
            event("ACTIVATE", "2026-01-01"),
            event("PLAN_CHANGED", "2026-02-01", change(1, 24000, "yearly")),
          ],
        }),
        order: { currency: "USD" },
        orderLine: { ...sub().orderLine!, netMinor: 1200 },
      },
      {
        ...sub({ transitions: [] }),
        order: { currency: "INR" },
        orderLine: { ...sub().orderLine!, netMinor: 1200 },
      },
    ]);
    const findPlans = vi
      .fn()
      .mockResolvedValue([{ id: "yearly", interval: "YEARLY" }]);
    const context = {
      db: {
        subscription: { findMany },
        subscriptionPlan: { findMany: findPlans },
      },
      scope: scoped,
      period,
      now,
    } as unknown as AnalyticsContext;
    const charts = await mrrHistoryCharts(context);
    expect(findMany.mock.calls[0][0].where).toEqual({
      order: { quotation: scoped },
    });
    expect(findMany.mock.calls[0][0].include.transitions.where).toEqual({
      effectiveAt: { lte: now },
    });
    expect(findPlans).toHaveBeenCalledWith({
      where: { id: { in: ["yearly"] } },
      select: { id: true, interval: true },
    });
    expect(charts[0].rows).toEqual([]);
    expect(charts[0].question).toMatch(/Incomplete subscription history/);
    expect(charts[1].rows.map((r) => r.value)).toEqual([12, 20, 20, 20]);
    expect(charts[1].unit).toBe("USD / month");
  });
});
