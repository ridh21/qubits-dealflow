import type { Interval } from "../pricing/types";
export type { Interval } from "../pricing/types";
export const INTERVALS: readonly Interval[] = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];
export type Def = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  per: "DAY" | "WEEK" | "MONTH" | "CYCLE";
  valueType: "INT" | "BOOL" | "TEXT";
};
export type Val = {
  definitionId: string;
  tierId: string;
  interval: Interval | null;
  value: unknown;
};
// Metadata accompanies generated cells so diffs can render human-readable notices.
export type Cell = {
  definitionId: string;
  tierId: string;
  interval: Interval;
  value: unknown | null;
  source: "OVERRIDE" | "TIER_DEFAULT" | "UNSET";
} & Partial<Pick<Def, "key" | "label" | "unit" | "per">>;
export type EffectiveValue = {
  value: unknown;
  source: Cell["source"];
  label: string;
  unit: string | null;
  per: Def["per"];
};

export function effectiveMatrix(
  defs: readonly Def[],
  tierIds: readonly string[],
  values: readonly Val[],
): Cell[] {
  const lookup = new Map(
    values.map((value) => [
      JSON.stringify([value.tierId, value.interval, value.definitionId]),
      value.value,
    ]),
  );
  return tierIds.flatMap((tierId) =>
    INTERVALS.flatMap((interval) =>
      defs.map((def) => {
        const override = lookup.get(JSON.stringify([tierId, interval, def.id]));
        const tierDefault = lookup.get(JSON.stringify([tierId, null, def.id]));
        const source: Cell["source"] =
          override != null
            ? "OVERRIDE"
            : tierDefault != null
              ? "TIER_DEFAULT"
              : "UNSET";
        return {
          definitionId: def.id,
          tierId,
          interval,
          value: override ?? tierDefault ?? null,
          source,
          key: def.key,
          label: def.label,
          unit: def.unit,
          per: def.per,
        };
      }),
    ),
  );
}

export function effectiveFor(
  defs: readonly Def[],
  values: readonly Val[],
  tierId: string,
  interval: Interval,
): Record<string, EffectiveValue> {
  return Object.fromEntries(
    effectiveMatrix(defs, [tierId], values)
      .filter((cell) => cell.interval === interval)
      .map((cell) => [
        cell.key!,
        {
          value: cell.value,
          source: cell.source,
          label: cell.label!,
          unit: cell.unit ?? null,
          per: cell.per!,
        },
      ]),
  );
}
