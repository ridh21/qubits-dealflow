import { describe, it, expect } from "vitest";
import { priceQuotation } from "./price-quotation";
import { validateForSubmission } from "./validate-submission";
import type { LineInput } from "./types";
const laptop: LineInput = {
  id: "l1",
  productId: "laptop",
  categoryId: "hw",
  qty: 2,
  unitPriceMinor: 120000,
  costPriceMinor: 90000,
  taxBp: 0,
  discountBp: 1200,
  interval: null,
  sortOrder: 0,
};
const service: LineInput = {
  ...laptop,
  id: "s1",
  productId: "setup",
  categoryId: "svc",
  qty: 1,
  unitPriceMinor: 45000,
  costPriceMinor: 30000,
  discountBp: 1800,
  sortOrder: 1,
};
const base = {
  tierCeilingBp: 1500,
  categoryCeilingsBp: { hw: 1500, svc: 1000, sub: 0 },
  orderDiscountBp: 0,
};
describe("quotation pricing", () => {
  it("matches scenario A and computes service excess", () => {
    const p = priceQuotation({ ...base, lines: [laptop, service] });
    expect(p.totalMinor).toBe(248100);
    expect(p.overallDiscountBp).toBe(1295);
    expect(p.lines[1]).toMatchObject({
      netMinor: 36900,
      excessBp: 800,
      marginMinor: 6900,
    });
  });
  it("combines discounts multiplicatively", () =>
    expect(
      priceQuotation({
        ...base,
        orderDiscountBp: 1000,
        lines: [{ ...laptop, discountBp: 1000 }],
      }).lines[0],
    ).toMatchObject({ netMinor: 194400, effectiveDiscountBp: 1900 }));
  it("separates recurring totals", () => {
    const p = priceQuotation({
      ...base,
      lines: [
        laptop,
        {
          ...service,
          interval: "MONTHLY",
          unitPriceMinor: 4600,
          discountBp: 0,
        },
      ],
    });
    expect(p.oneTime.netMinor).toBe(211200);
    expect(p.recurringByCycle.MONTHLY?.netMinor).toBe(4600);
  });
  it("allocates globally and breaks residual ties in stable order", () => {
    const lines = [
      {
        ...laptop,
        qty: 1,
        unitPriceMinor: 1,
        costPriceMinor: 0,
        discountBp: 0,
      },
      {
        ...service,
        unitPriceMinor: 1,
        costPriceMinor: 0,
        discountBp: 0,
        interval: "MONTHLY" as const,
      },
    ];
    const p = priceQuotation({ ...base, lines, orderDiscountBp: 5000 });
    expect(p.lines.map((l) => l.orderDiscountAllocMinor)).toEqual([1, 0]);
    expect(
      priceQuotation({
        ...base,
        lines: lines.reverse(),
        orderDiscountBp: 5000,
      }),
    ).toEqual(p);
  });
  it("rejects overflow and malformed amounts", () => {
    expect(() =>
      priceQuotation({ ...base, lines: [{ ...laptop, qty: 2147483647 }] }),
    ).toThrow();
    expect(() =>
      priceQuotation({ ...base, lines: [{ ...laptop, qty: -1 }] }),
    ).toThrow();
  });
  it("blocks missing configuration and empty/zero price submission", () => {
    expect(
      validateForSubmission(
        priceQuotation({ ...base, lines: [] }),
        { rejectZeroPriceLines: true },
        { hasActivePolicy: false, linesMissingCost: [] },
      ).errors.map((e) => e.code),
    ).toEqual(["POLICY_MISSING", "NO_LINES"]);
    const p = priceQuotation({
      ...base,
      lines: [{ ...laptop, unitPriceMinor: 0 }],
    });
    expect(
      validateForSubmission(
        p,
        { rejectZeroPriceLines: true },
        {
          hasActivePolicy: true,
          linesMissingCost: ["l1"],
          categoryCeilingsBp: {},
        },
      ).errors.map((e) => e.code),
    ).toEqual(["ZERO_PRICE_LINE", "MISSING_COST", "CATEGORY_CEILING_MISSING"]);
  });
});
