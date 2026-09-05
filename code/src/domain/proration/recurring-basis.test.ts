import { describe, expect, it } from "vitest";
import { periodAmount, recurringPriceBasis } from "./prorate";
describe("exact accepted recurring price basis", () => {
  it("preserves stacked-discount allocation amounts that a rounded percentage loses", () => {
    const basis = recurringPriceBasis({
      qty: 1000,
      unitPriceMinor: 123456,
      netMinor: 94866993,
    });
    expect(periodAmount(1000, 123456, 2316)).toBe(94863590);
    expect(periodAmount(1000, 123456, 2316, basis)).toBe(94866993);
    expect(periodAmount(2000, 123456, 2316, basis)).toBe(189733986);
  });
  it("scales the accepted discount ratio while preserving quotation rounding", () => {
    const basis = { grossMinor: 2, netMinor: 1 };
    expect(periodAmount(1, 1, 5000, basis)).toBe(0);
    expect(periodAmount(4, 1, 5000, basis)).toBe(2);
    expect(periodAmount(0, 1, 5000, basis)).toBe(0);
  });
  it("supports free initial plans and rejects impossible accepted amounts", () => {
    expect(periodAmount(1, 0, 0, { grossMinor: 0, netMinor: 0 })).toBe(0);
    expect(periodAmount(1, 100, 0, { grossMinor: 0, netMinor: 0 })).toBe(100);
    expect(() =>
      periodAmount(1, 100, 0, { grossMinor: 100, netMinor: 101 }),
    ).toThrow();
  });
});
