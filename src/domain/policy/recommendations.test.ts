import { it, expect } from "vitest";
import {
  computeCopurchasePairs,
  previewRecommendations,
} from "./recommendations";
import { POLICY_DEFAULTS } from "./schemas";
it("counts directed co-purchases once per order with stable ordering", () => {
  expect(
    computeCopurchasePairs([
      { productIds: ["b", "a", "a"] },
      { productIds: ["a", "b"] },
    ]),
  ).toEqual([
    {
      productId: "a",
      suggestedProductId: "b",
      weight: 2,
      source: "COPURCHASE",
    },
    {
      productId: "b",
      suggestedProductId: "a",
      weight: 2,
      source: "COPURCHASE",
    },
  ]);
});
it("filters unavailable and low-margin recommendations after promotion", () => {
  const p = {
    ...POLICY_DEFAULTS.RECOMMENDATION,
    rules: computeCopurchasePairs([{ productIds: ["a", "b", "c"] }]),
    promotions: { b: 5000 },
  };
  const products = [
    {
      id: "b",
      name: "B",
      priceMinor: 1000,
      costMinor: 600,
      minMarginBp: 1000,
      active: true,
      available: true,
      promoted: false,
    },
    {
      id: "c",
      name: "C",
      priceMinor: 1000,
      costMinor: 100,
      minMarginBp: 1000,
      active: true,
      available: false,
      promoted: true,
    },
  ];
  expect(previewRecommendations(p, ["a"], products)).toEqual([]);
});
