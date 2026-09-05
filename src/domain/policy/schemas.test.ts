import { describe, it, expect } from "vitest";
import {
  POLICY_DEFAULTS,
  POLICY_SCHEMAS,
  PolicyKindZ,
  DEFAULT_DISCOUNT_RISK,
  canPublishPolicy,
} from "./schemas";
import { validateDiscountRisk } from "./validate-discount-risk";
describe("policy schemas", () => {
  it.each(PolicyKindZ.options)("parses %s defaults", (kind) =>
    expect(POLICY_SCHEMAS[kind].safeParse(POLICY_DEFAULTS[kind]).success).toBe(
      true,
    ),
  );
  it.each([-1, 10001, 1.1, NaN, Infinity])(
    "rejects invalid basis points %s",
    (bp) =>
      expect(
        POLICY_SCHEMAS.DISCOUNT_RISK.safeParse({
          ...DEFAULT_DISCOUNT_RISK,
          overallCeilingBp: bp,
        }).success,
      ).toBe(false),
  );
  it("bounds durations and promotions", () => {
    expect(
      POLICY_SCHEMAS.BILLING.safeParse({ invoiceDueDays: -1 }).success,
    ).toBe(false);
    expect(
      POLICY_SCHEMAS.RECOMMENDATION.safeParse({ promotions: { p: 10001 } })
        .success,
    ).toBe(false);
  });
  it("restricts manager publishing to discount risk", () => {
    expect(canPublishPolicy("SALES_MANAGER", "DISCOUNT_RISK")).toBe(true);
    expect(canPublishPolicy("SALES_MANAGER", "BILLING")).toBe(false);
    expect(canPublishPolicy("FINANCE", "DISCOUNT_RISK")).toBe(false);
  });
});
describe("discount validation", () => {
  it("accepts defaults with dormant overall conditions", () =>
    expect(validateDiscountRisk(DEFAULT_DISCOUNT_RISK)).toEqual({ ok: true }));
  it("rejects a dormant-only rule", () => {
    const p = structuredClone(DEFAULT_DISCOUNT_RISK);
    p.routingRules[0].anyLineExcess = false;
    expect(validateDiscountRisk(p).ok).toBe(false);
  });
  it("rejects level gaps, duplicates and chain overflow", () => {
    for (const level of [1, 3]) {
      const p = structuredClone(DEFAULT_DISCOUNT_RISK);
      p.routingRules[1].level = level;
      expect(validateDiscountRisk(p).ok).toBe(false);
    }
  });
  it("rejects descending metric thresholds", () => {
    const p = structuredClone(DEFAULT_DISCOUNT_RISK);
    p.routingRules[0].worstExcessGteBp = 800;
    p.routingRules[1].worstExcessGteBp = 400;
    expect(validateDiscountRisk(p).ok).toBe(false);
  });
  it("rejects repeated reviewers", () => {
    expect(
      validateDiscountRisk({
        ...DEFAULT_DISCOUNT_RISK,
        reviewerChain: ["FINANCE", "FINANCE"],
      }).ok,
    ).toBe(false);
  });
  it("rejects missing tiers and any-line conditions above level 1", () => {
    const p = structuredClone(DEFAULT_DISCOUNT_RISK);
    p.routingRules[1].anyLineExcess = true;
    expect(validateDiscountRisk(p).ok).toBe(false);
    expect(
      validateDiscountRisk({ ...p, tierCeilingsBp: { GOLD: 1500 } }).ok,
    ).toBe(false);
  });
});
