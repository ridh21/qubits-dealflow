import { it, expect } from "vitest";
import { diffPolicy } from "./diff";
it("compares nested settings and arrays by index", () => {
  expect(
    diffPolicy(
      { a: { b: 1 }, chain: ["FINANCE", "SALES_MANAGER"] },
      { a: { b: 2 }, chain: ["SALES_MANAGER"] },
    ),
  ).toEqual([
    { path: "a.b", before: 1, after: 2 },
    { path: "chain.0", before: "FINANCE", after: "SALES_MANAGER" },
    { path: "chain.1", before: "SALES_MANAGER", after: null },
  ]);
});
it("ignores object key order and keeps null additions visible", () => {
  expect(diffPolicy({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  expect(diffPolicy({}, { a: null })).toEqual([
    { path: "a", before: null, after: null },
  ]);
});
