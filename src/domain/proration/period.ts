import type { Interval } from "../pricing/types";
export type { Interval } from "../pricing/types";

export interface Period {
  start: Date;
  end: Date;
}
export const DAY_MS = 86_400_000;
export const INTERVAL_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
} as const;

export function assertDate(date: Date): void {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date");
}

/** Month is zero-based, matching Date.UTC. All billing arithmetic uses UTC. */
export function clampToMonthDay(
  year: number,
  month: number,
  day: number,
): Date {
  if (![year, month, day].every(Number.isInteger) || day < 1 || day > 31) {
    throw new RangeError("Invalid calendar anchor");
  }
  const result = new Date(0);
  result.setUTCFullYear(year, month + 1, 0);
  result.setUTCDate(Math.min(day, result.getUTCDate()));
  return result;
}

export function periodEnd(
  interval: Interval,
  start: Date,
  anchorDay = start.getUTCDate(),
): Date {
  assertDate(start);
  if (interval === "WEEKLY") return new Date(start.getTime() + 7 * DAY_MS);
  const result = clampToMonthDay(
    start.getUTCFullYear(),
    start.getUTCMonth() + INTERVAL_MONTHS[interval],
    anchorDay,
  );
  result.setUTCHours(
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  );
  return result;
}

export function periodDays(start: Date, end: Date): number {
  assertDate(start);
  assertDate(end);
  if (end <= start) throw new RangeError("Period end must follow start");
  return (end.getTime() - start.getTime()) / DAY_MS;
}

export function nextPeriod(
  interval: Interval,
  currentEnd: Date,
  anchorDay: number,
): Period {
  return {
    start: new Date(currentEnd),
    end: periodEnd(interval, currentEnd, anchorDay),
  };
}
