import { expect, it } from "vitest";
import { affectedKeys, diffEntitlements, groupChangesForNotices } from "./diff";
import { effectiveMatrix, type Def, type Val } from "./effective";
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
const matrix = (value: number, override = false) =>
  effectiveMatrix(
    defs,
    ["pro"],
    [
      { definitionId: "photos", tierId: "pro", interval: null, value },
      ...(override
        ? [
            {
              definitionId: "photos",
              tierId: "pro",
              interval: "MONTHLY",
              value: 7,
            } satisfies Val,
          ]
        : []),
    ],
  );
it("omits overridden cycles and does not collapse three-cycle changes", () => {
  const changes = diffEntitlements(matrix(5, true), matrix(2, true));
  expect(changes.map((change) => change.interval)).toEqual([
    "WEEKLY",
    "QUARTERLY",
    "YEARLY",
  ]);
  expect(changes[0]).toMatchObject({
    key: "photos_per_day",
    label: "Photos per day",
    before: 5,
    after: 2,
  });
  expect(groupChangesForNotices(changes)).toHaveLength(3);
});
it("collapses all four identical cycle changes", () => {
  const groups = groupChangesForNotices(diffEntitlements(matrix(5), matrix(2)));
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ tierId: "pro", interval: null });
  expect(groups[0].changes).toHaveLength(1);
});
it("ignores source-only changes and captures removed values", () => {
  const before = matrix(5);
  expect(
    diffEntitlements(
      before,
      before.map((cell) => ({ ...cell, source: "OVERRIDE" })),
    ),
  ).toEqual([]);
  expect(
    diffEntitlements(before, []).every((change) => change.after === null),
  ).toBe(true);
  expect(affectedKeys("pro", null)).toHaveLength(4);
  expect(affectedKeys("pro", "MONTHLY")).toEqual([
    { tierId: "pro", interval: "MONTHLY" },
  ]);
});
it("does not collapse cycles with different effective changes", () => {
  const changes = diffEntitlements(matrix(5), matrix(2));
  changes[1].after = 8;
  expect(groupChangesForNotices(changes)).toHaveLength(4);
});
