import { describe, expect, it } from "vitest";
import { detectStalled } from "./stalled";
import { repBaseline, detectDiscountAnomaly } from "./anomaly";
import { detectSlippage } from "./slippage";
const now = new Date("2026-09-20T00:00:00Z");
describe("deal health detectors", () => {
  it("uses meaningful inactivity with exact threshold and severity boundaries", () => {
    const quote = {
      id: "q",
      status: "SENT",
      lastActivityAt: new Date("2026-09-13T00:00:00Z"),
    };
    expect(detectStalled([quote], now, 7)[0].severity).toBe("MEDIUM");
    expect(
      detectStalled(
        [{ ...quote, lastActivityAt: new Date("2026-09-06T00:00:00Z") }],
        now,
        7,
      )[0].severity,
    ).toBe("HIGH");
    expect(
      detectStalled(
        [
          { ...quote, status: "CONFIRMED" },
          { ...quote, lastActivityAt: now },
        ],
        now,
        7,
      ),
    ).toEqual([]);
  });
  it("excludes future and outside-window submissions and other owners", () => {
    expect(
      repBaseline(
        [
          {
            ownerId: "r",
            submittedAt: new Date("2026-09-01"),
            effectiveDiscountBp: 800,
          },
          { ownerId: "r", submittedAt: now, effectiveDiscountBp: 9000 },
          {
            ownerId: "x",
            submittedAt: new Date("2026-09-01"),
            effectiveDiscountBp: 9000,
          },
          {
            ownerId: "r",
            submittedAt: new Date("2025-09-01"),
            effectiveDiscountBp: 9000,
          },
        ],
        "r",
        now,
        90,
      ),
    ).toEqual({ mean: 800, n: 1 });
  });
  it("requires sufficient history and honors configurable delta", () => {
    const cfg = { minDeltaBp: 1000, minSamples: 5 };
    expect(
      detectDiscountAnomaly(
        { id: "q", overallDiscountBp: 2200 },
        { mean: 800, n: 4 },
        cfg,
      ).reason,
    ).toBe("INSUFFICIENT_HISTORY");
    expect(
      detectDiscountAnomaly(
        { id: "q", overallDiscountBp: 1500 },
        { mean: 800, n: 7 },
        cfg,
      ).alert,
    ).toBeNull();
    expect(
      detectDiscountAnomaly(
        { id: "q", overallDiscountBp: 2200 },
        { mean: 800, n: 7 },
        cfg,
      ).alert?.severity,
    ).toBe("MEDIUM");
    expect(
      detectDiscountAnomaly(
        { id: "q", overallDiscountBp: 2800 },
        { mean: 800, n: 7 },
        cfg,
      ).alert?.severity,
    ).toBe("HIGH");
  });
  it("distinguishes missed promises, uncovered backorders and approaching delivery", () => {
    const order = {
      id: "o",
      promisedDeliveryDate: new Date("2026-09-22"),
      unshippedQty: 6,
      openBackorderQty: 0,
      earliestReplenishmentEta: null,
    };
    expect(detectSlippage([order], now, 3)[0].severity).toBe("MEDIUM");
    expect(
      detectSlippage([{ ...order, openBackorderQty: 2 }], now, 3)[0].detail
        .label,
    ).toContain("no replenishment");
    expect(
      detectSlippage(
        [{ ...order, promisedDeliveryDate: new Date("2026-09-18") }],
        now,
        3,
      )[0].detail.label,
    ).toContain("2 days");
    expect(
      detectSlippage(
        [
          { ...order, unshippedQty: 0 },
          { ...order, promisedDeliveryDate: null },
        ],
        now,
        3,
      ),
    ).toEqual([]);
  });
});
