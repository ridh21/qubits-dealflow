import { INTERVALS, type Cell, type Def, type Interval } from "./effective";

export interface Change {
  tierId: string;
  interval: Interval;
  key: string;
  label: string;
  unit: string | null;
  per: Def["per"];
  before: unknown | null;
  after: unknown | null;
}
export interface NoticeGroup {
  tierId: string;
  interval: Interval | null;
  changes: Change[];
}

const cellKey = (cell: Cell) =>
  JSON.stringify([cell.tierId, cell.interval, cell.definitionId]);

export function diffEntitlements(
  before: readonly Cell[],
  after: readonly Cell[],
): Change[] {
  const previous = new Map(before.map((cell) => [cellKey(cell), cell]));
  const current = new Map(after.map((cell) => [cellKey(cell), cell]));
  const keys = new Set([...previous.keys(), ...current.keys()]);
  return [...keys].flatMap((key) => {
    const oldCell = previous.get(key);
    const newCell = current.get(key);
    const oldValue = oldCell?.value ?? null;
    const newValue = newCell?.value ?? null;
    if (Object.is(oldValue, newValue)) return [];
    const cell = newCell ?? oldCell!;
    return [
      {
        tierId: cell.tierId,
        interval: cell.interval,
        key: cell.key ?? cell.definitionId,
        label: cell.label ?? cell.definitionId,
        unit: cell.unit ?? null,
        per: cell.per ?? "CYCLE",
        before: oldValue,
        after: newValue,
      },
    ];
  });
}

export function affectedKeys(
  tierId: string,
  interval: Interval | null,
): { tierId: string; interval: Interval }[] {
  return (interval ? [interval] : INTERVALS).map((cycle) => ({
    tierId,
    interval: cycle,
  }));
}

export function groupChangesForNotices(
  changes: readonly Change[],
): NoticeGroup[] {
  const groups: NoticeGroup[] = [];
  for (const tierId of new Set(changes.map((change) => change.tierId))) {
    const byCycle = INTERVALS.map((interval) =>
      changes.filter(
        (change) => change.tierId === tierId && change.interval === interval,
      ),
    );
    const signature = (items: Change[]) =>
      JSON.stringify(
        items
          .map((change) => ({ ...change, interval: null }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      );
    if (
      byCycle[0].length > 0 &&
      byCycle.every((items) => signature(items) === signature(byCycle[0]))
    ) {
      groups.push({ tierId, interval: null, changes: byCycle[0] });
    } else {
      byCycle.forEach((items, index) => {
        if (items.length)
          groups.push({ tierId, interval: INTERVALS[index], changes: items });
      });
    }
  }
  return groups;
}
