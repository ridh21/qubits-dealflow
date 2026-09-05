import Decimal from "decimal.js";
import { applyDiscount, pctOf } from "../money/money";
import {
  assertDate,
  DAY_MS,
  periodDays,
  periodEnd,
  type Interval,
  type Period,
} from "./period";

export type ProrationRule = "DAILY" | "NONE";
export type CancellationRule = "NONE" | "PRORATED_CREDIT" | "FULL_CREDIT";
export interface ChangeDelta {
  netMinor: number;
  taxMinor: number;
  kind: "CHARGE" | "CREDIT" | "NONE";
  description: string;
}
export interface QuantityChangeInput {
  qty: number;
  unitPriceMinor: number;
  discountBp: number;
  taxBp: number;
  period: Period;
  rule: ProrationRule;
}
export interface SameCycleChangeInput {
  oldPeriodAmount: number;
  newPeriodAmount: number;
  taxBp: number;
  period: Period;
  rule: ProrationRule;
}
export interface DifferentCycleChangeInput {
  oldPeriodAmount: number;
  oldPeriod: Period;
  newPeriodAmount: number;
  newInterval: Interval;
  taxBp: number;
  rule: ProrationRule;
}
export interface CancellationInput {
  periodAmount: number;
  period: Period;
  rule: CancellationRule;
  invoiced: boolean;
  mode: "END_OF_PERIOD" | "IMMEDIATE";
}

export function prorate(amountMinor: number, period: Period, at: Date): number {
  assertDate(at);
  const days = periodDays(period.start, period.end);
  const remaining = Math.max(
    0,
    Math.min(days, (period.end.getTime() - at.getTime()) / DAY_MS),
  );
  return new Decimal(amountMinor)
    .mul(remaining)
    .div(days)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function periodAmount(
  qty: number,
  unitPriceMinor: number,
  discountBp: number,
): number {
  if (!Number.isSafeInteger(qty) || qty < 0)
    throw new RangeError("Quantity must be a nonnegative integer");
  return applyDiscount(
    new Decimal(qty).mul(unitPriceMinor).toNumber(),
    discountBp,
  );
}

function delta(
  netMinor: number,
  taxBp: number,
  description: string,
): ChangeDelta {
  return {
    netMinor,
    taxMinor: pctOf(netMinor, taxBp),
    kind: netMinor > 0 ? "CHARGE" : netMinor < 0 ? "CREDIT" : "NONE",
    description,
  };
}

export function quantityChange(
  input: QuantityChangeInput,
  newQty: number,
  at: Date,
): ChangeDelta {
  return planChangeSameCycle(
    {
      ...input,
      oldPeriodAmount: periodAmount(
        input.qty,
        input.unitPriceMinor,
        input.discountBp,
      ),
      newPeriodAmount: periodAmount(
        newQty,
        input.unitPriceMinor,
        input.discountBp,
      ),
    },
    at,
  );
}

export function planChangeSameCycle(
  input: SameCycleChangeInput,
  at: Date,
): ChangeDelta {
  return delta(
    input.rule === "NONE"
      ? 0
      : prorate(
          input.newPeriodAmount - input.oldPeriodAmount,
          input.period,
          at,
        ),
    input.taxBp,
    input.rule === "NONE"
      ? "Change applies next period"
      : "Prorated subscription change",
  );
}

export function planChangeDifferentCycle(
  input: DifferentCycleChangeInput,
  at: Date,
): {
  creditMinor: number;
  chargeMinor: number;
  newPeriod: Period;
  description: string;
} {
  const start = input.rule === "NONE" ? input.oldPeriod.end : at;
  return {
    creditMinor:
      input.rule === "NONE"
        ? 0
        : prorate(input.oldPeriodAmount, input.oldPeriod, at),
    chargeMinor: input.newPeriodAmount,
    newPeriod: {
      start: new Date(start),
      end: periodEnd(input.newInterval, start),
    },
    description:
      input.rule === "NONE"
        ? "New cycle starts next period"
        : "Credit unused period and charge new cycle",
  };
}

export function cancellation(
  input: CancellationInput,
  at: Date,
): { creditMinor: number; effectiveAt: Date } {
  assertDate(at);
  if (input.mode === "END_OF_PERIOD")
    return { creditMinor: 0, effectiveAt: new Date(input.period.end) };
  const creditMinor =
    !input.invoiced || input.rule === "NONE"
      ? 0
      : input.rule === "FULL_CREDIT"
        ? input.periodAmount
        : prorate(input.periodAmount, input.period, at);
  return { creditMinor, effectiveAt: new Date(at) };
}
