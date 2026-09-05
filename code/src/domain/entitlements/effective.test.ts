import { expect, it } from "vitest";
import { effectiveFor, effectiveMatrix, type Def } from "./effective";
const defs: Def[] = [
  {
    id: "photos",
    key: "photos_per_day",
    label: "Photos per day",
    unit: "photos",
    per: "DAY",
    valueType: "INT",
  },
];
it("autofills all cycles and respects overrides and resets", () => {
  const values = [
    { definitionId: "photos", tierId: "pro", interval: null, value: 5 },
  ];
  expect(
    effectiveMatrix(defs, ["pro"], values).map((cell) => [
      cell.value,
      cell.source,
    ]),
  ).toEqual(Array(4).fill([5, "TIER_DEFAULT"]));
  const withOverride = [
    ...values,
    { ...values[0], interval: "MONTHLY" as const, value: 7 },
  ];
  expect(
    effectiveFor(defs, withOverride, "pro", "MONTHLY").photos_per_day.value,
  ).toBe(7);
  expect(
    effectiveMatrix(defs, ["pro"], []).every(
      (cell) => cell.source === "UNSET" && cell.value === null,
    ),
  ).toBe(true);
  expect(
    effectiveFor(
      defs,
      [...values, { ...values[0], interval: "MONTHLY", value: null }],
      "pro",
      "MONTHLY",
    ).photos_per_day.value,
  ).toBe(5);
});
it("preserves false, zero, empty text and tier isolation", () => {
  for (const [valueType, value] of [
    ["BOOL", false],
    ["INT", 0],
    ["TEXT", ""],
  ] as const) {
    const matrix = effectiveMatrix(
      [{ ...defs[0], valueType }],
      ["pro", "plus"],
      [{ definitionId: "photos", tierId: "pro", interval: "MONTHLY", value }],
    );
    expect(
      matrix.find(
        (cell) => cell.tierId === "pro" && cell.interval === "MONTHLY",
      ),
    ).toMatchObject({ value, source: "OVERRIDE" });
    expect(
      matrix
        .filter((cell) => cell.tierId === "plus")
        .every((cell) => cell.source === "UNSET"),
    ).toBe(true);
  }
});
