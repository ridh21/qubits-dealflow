import { expect, it } from "vitest";
import { applyCredits } from "./apply-credit";
it("applies oldest credits first without mutating, retaining excess credit", () => {
  const credits = [
    { id: "new", remainingMinor: 800, createdAt: new Date("2026-09-02") },
    { id: "old", remainingMinor: 400, createdAt: new Date("2026-09-01") },
  ];
  expect(applyCredits(1000, credits)).toMatchObject({
    applications: [
      { creditNoteId: "old", amountMinor: 400 },
      { creditNoteId: "new", amountMinor: 600 },
    ],
    balanceMinor: 0,
    creditAppliedMinor: 1000,
    credits: [
      { id: "old", remainingMinor: 0 },
      { id: "new", remainingMinor: 200 },
    ],
  });
  expect(credits[0].remainingMinor).toBe(800);
  expect(applyCredits(0, credits).applications).toEqual([]);
  expect(applyCredits(1000, []).balanceMinor).toBe(1000);
});
it("rejects invalid or duplicated credits", () => {
  const credit = { id: "a", remainingMinor: 1, createdAt: new Date() };
  expect(() => applyCredits(10, [credit, credit])).toThrow();
  expect(() => applyCredits(-1, [])).toThrow();
  expect(() => applyCredits(1, [{ ...credit, remainingMinor: -1 }])).toThrow();
});
