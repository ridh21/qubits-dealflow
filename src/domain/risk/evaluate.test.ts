import { describe, it, expect } from "vitest";
import { DEFAULT_DISCOUNT_RISK } from "../policy/schemas";
import { simulateDiscountRisk, type SimInput } from "./evaluate";
const policy = {
  ...DEFAULT_DISCOUNT_RISK,
  categoryCeilingsBp: { hardware: 1500, services: 1000, subscription: 0 },
};
const line = (
  categoryId: string,
  discountBp: number,
  baseMinor = 10000,
  cycle: SimInput["lines"][number]["cycle"] = "ONE_TIME",
) => ({ id: categoryId, categoryId, discountBp, baseMinor, cycle });
const sample = (lines: SimInput["lines"], orderDiscountBp = 0): SimInput => ({
  tier: "GOLD",
  lines,
  orderDiscountBp,
});
describe("risk simulator", () => {
  it("passes gold hardware at 12% and escalates services at 18%", () => {
    expect(
      simulateDiscountRisk(policy, sample([line("hardware", 1200)]))
        .requiredLevel,
    ).toBe(0);
    const r = simulateDiscountRisk(policy, sample([line("services", 1800)]));
    expect(r.lines[0].excessBp).toBe(800);
    expect(r.route).toEqual(["SALES_MANAGER", "FINANCE"]);
  });
  it("routes any small positive excess to manager", () => {
    expect(
      simulateDiscountRisk(policy, sample([line("services", 1001)]))
        .requiredLevel,
    ).toBe(1);
  });
  it("ignores overall thresholds with no configured ceiling", () => {
    const r = simulateDiscountRisk(policy, sample([line("hardware", 1400)]));
    expect(r.buckets[0].overallExcessBp).toBeNull();
    expect(r.requiredLevel).toBe(0);
  });
  it("can escalate overall ceiling when lines pass", () => {
    const r = simulateDiscountRisk(
      { ...policy, overallCeilingBp: 500 },
      sample([line("hardware", 1200)]),
    );
    expect(r.requiredLevel).toBe(2);
  });
  it("clamps overall excess at zero", () => {
    expect(
      simulateDiscountRisk(
        { ...policy, overallCeilingBp: 1500 },
        sample([line("hardware", 100)]),
      ).buckets[0].overallExcessBp,
    ).toBe(0);
  });
  it("keeps recurring buckets separate", () => {
    const r = simulateDiscountRisk(
      policy,
      sample([
        line("hardware", 0, 1000000, "YEARLY"),
        line("services", 1600, 10000, "MONTHLY"),
      ]),
    );
    expect(r.buckets).toHaveLength(2);
    expect(r.requiredLevel).toBe(2);
  });
  it("allocates order discounts globally before bucketing", () => {
    const r = simulateDiscountRisk(
      policy,
      sample(
        [line("hardware", 0, 1, "YEARLY"), line("services", 0, 1, "MONTHLY")],
        5000,
      ),
    );
    expect(r.lines.map((l) => l.netMinor)).toEqual([0, 1]);
  });
  it("rounds effective and blended basis points to integers", () => {
    const r = simulateDiscountRisk(
      policy,
      sample([line("hardware", 1295, 100000), line("services", 1201, 9999)]),
    );
    expect(r.lines.every((l) => Number.isInteger(l.effectiveDiscountBp))).toBe(
      true,
    );
    expect(Number.isInteger(r.buckets[0].blendedExcessBp)).toBe(true);
  });
  it("blocks missing category configuration and zero price by default", () => {
    expect(() =>
      simulateDiscountRisk(policy, sample([line("missing", 0)])),
    ).toThrow("Set a discount ceiling");
    expect(() =>
      simulateDiscountRisk(policy, sample([line("hardware", 0, 0)])),
    ).toThrow("Zero-price");
  });
  it("represents supported free lines without a denominator", () => {
    const r = simulateDiscountRisk(
      { ...policy, rejectZeroPriceLines: false },
      sample([line("hardware", 0, 0)]),
    );
    expect(r.lines[0].effectiveDiscountBp).toBeNull();
    expect(r.buckets[0].overallDiscountBp).toBeNull();
  });
});
