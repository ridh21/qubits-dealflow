import { describe, expect, it } from "vitest";
import {
  completionInvoiceLine,
  proportionalSlice,
  recurringInvoiceLine,
  shipmentInvoiceLines,
} from "./invoice-lines";
const line = {
  id: "line",
  productName: "Goods",
  qty: 3,
  qtyInvoiced: 0,
  unitPriceMinor: 334,
  netMinor: 1001,
  taxMinor: 101,
};

describe("invoice lines", () => {
  it("allocates cumulative cents and tax across separate shipments", () => {
    const results = [0, 1, 2].map(
      (qtyInvoiced) =>
        shipmentInvoiceLines(
          [{ ...line, qtyInvoiced }],
          [{ orderLineId: "line", qty: 1 }],
        )[0],
    );
    expect(results.map((result) => result.amountMinor)).toEqual([
      334, 334, 333,
    ]);
    expect(results.map((result) => result.taxMinor)).toEqual([34, 34, 33]);
    expect(line.qtyInvoiced).toBe(0);
  });
  it("allocates equal halves and tracks duplicate rows within a shipment", () => {
    expect(
      shipmentInvoiceLines(
        [{ ...line, qty: 2, netMinor: 211200 }],
        [
          { orderLineId: "line", qty: 1 },
          { orderLineId: "line", qty: 1 },
        ],
      ).map((result) => result.amountMinor),
    ).toEqual([105600, 105600]);
  });
  it("conserves every cent independent of grouping", () => {
    for (let total = 0; total < 30; total++) {
      for (let qty = 1; qty <= 8; qty++) {
        for (let split = 0; split <= qty; split++) {
          expect(
            proportionalSlice(total, qty, 0, split) +
              proportionalSlice(total, qty, split, qty - split),
          ).toBe(total);
        }
      }
    }
  });
  it("rejects overshipment, unknown lines and invalid quantities", () => {
    expect(() =>
      shipmentInvoiceLines([line], [{ orderLineId: "missing", qty: 1 }]),
    ).toThrow();
    for (const qty of [0, -1, 1.5, 4])
      expect(() =>
        shipmentInvoiceLines([line], [{ orderLineId: "line", qty }]),
      ).toThrow();
    expect(() =>
      shipmentInvoiceLines(
        [{ ...line, qtyInvoiced: 2 }],
        [{ orderLineId: "line", qty: 2 }],
      ),
    ).toThrow();
  });
  it("bills completion in full and recurring discounted net with half-up tax", () => {
    expect(completionInvoiceLine(line)).toMatchObject({
      amountMinor: 1001,
      taxMinor: 101,
      qty: 3,
    });
    expect(
      recurringInvoiceLine(
        { id: "sub", qty: 1, unitPriceMinor: 105, discountBp: 0, taxBp: 1000 },
        { start: new Date("2026-09-01"), end: new Date("2026-10-01") },
      ),
    ).toMatchObject({ amountMinor: 105, taxMinor: 11, subscriptionId: "sub" });
  });
});
