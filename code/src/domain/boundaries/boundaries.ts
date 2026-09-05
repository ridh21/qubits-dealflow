import {
  assertDate,
  clampToMonthDay,
  DAY_MS,
  INTERVAL_MONTHS,
  type Interval,
} from "../proration/period";

function boundaryAt(anchor: Date, interval: Interval, index: number): Date {
  if (interval === "WEEKLY")
    return new Date(anchor.getTime() + index * 7 * DAY_MS);
  const result = clampToMonthDay(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + index * INTERVAL_MONTHS[interval],
    anchor.getUTCDate(),
  );
  result.setUTCHours(
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  );
  return result;
}

function firstIndex(anchor: Date, interval: Interval, date: Date): number {
  assertDate(anchor);
  assertDate(date);
  if (date <= anchor) return 0;
  let index =
    interval === "WEEKLY"
      ? Math.floor((date.getTime() - anchor.getTime()) / (7 * DAY_MS))
      : Math.floor(
          ((date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
            date.getUTCMonth() -
            anchor.getUTCMonth()) /
            INTERVAL_MONTHS[interval],
        );
  if (boundaryAt(anchor, interval, index) < date) index++;
  return index;
}

/** Includes the anchor, but never invents billing periods before activation. */
export function boundariesFrom(
  anchor: Date,
  interval: Interval,
  from: Date,
  count: number,
): Date[] {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new RangeError("Invalid boundary count");
  const index = firstIndex(anchor, interval, from);
  return Array.from({ length: count }, (_, offset) =>
    boundaryAt(anchor, interval, index + offset),
  );
}

export function firstBoundaryOnOrAfter(
  anchor: Date,
  interval: Interval,
  date: Date,
): Date {
  return boundaryAt(anchor, interval, firstIndex(anchor, interval, date));
}

export function isBoundary(
  anchor: Date,
  interval: Interval,
  date: Date,
): boolean {
  return (
    firstBoundaryOnOrAfter(anchor, interval, date).getTime() === date.getTime()
  );
}
