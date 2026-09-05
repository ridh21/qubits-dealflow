import { expect, it } from "vitest";
import {
  boundariesFrom,
  firstBoundaryOnOrAfter,
  isBoundary,
} from "./boundaries";
const d = (value: string) => new Date(value);
it("preserves month-end anchors and includes an exact boundary", () => {
  const anchor = d("2026-01-31");
  expect(boundariesFrom(anchor, "MONTHLY", d("2026-10-01"), 3)).toEqual([
    d("2026-10-31"),
    d("2026-11-30"),
    d("2026-12-31"),
  ]);
  expect(isBoundary(anchor, "MONTHLY", d("2026-02-28"))).toBe(true);
  expect(isBoundary(anchor, "MONTHLY", d("2026-03-28"))).toBe(false);
  expect(firstBoundaryOnOrAfter(anchor, "MONTHLY", d("2026-10-31"))).toEqual(
    d("2026-10-31"),
  );
});
it("supports weekly, quarterly and leap-year boundaries without drift", () => {
  expect(boundariesFrom(d("2026-09-02"), "WEEKLY", d("2026-09-03"), 2)).toEqual(
    [d("2026-09-09"), d("2026-09-16")],
  );
  expect(
    boundariesFrom(d("2026-11-30"), "QUARTERLY", d("2027-01-01"), 2),
  ).toEqual([d("2027-02-28"), d("2027-05-30")]);
  expect(boundariesFrom(d("2028-02-29"), "YEARLY", d("2029-01-01"), 4)).toEqual(
    [d("2029-02-28"), d("2030-02-28"), d("2031-02-28"), d("2032-02-29")],
  );
});
it("uses exact timestamps, excludes preactivation periods and validates count", () => {
  const anchor = d("2026-01-31T12:00:00Z");
  expect(
    firstBoundaryOnOrAfter(anchor, "MONTHLY", d("2026-02-28T12:00:00.001Z")),
  ).toEqual(d("2026-03-31T12:00:00Z"));
  expect(firstBoundaryOnOrAfter(anchor, "MONTHLY", d("2025-01-01"))).toEqual(
    anchor,
  );
  expect(boundariesFrom(anchor, "MONTHLY", anchor, 0)).toEqual([]);
  expect(() => boundariesFrom(anchor, "MONTHLY", anchor, -1)).toThrow();
});
