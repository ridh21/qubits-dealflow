import type { RecurringPriceBasis } from "@/domain/proration/prorate";
import { mrr } from "@/domain/reports/kpis";
import type { Interval } from "@/domain/proration/period";

interface Terms {
  pricingBasis?: RecurringPriceBasis;
  qty: number;
  unitPriceMinor: number;
  discountBp: number;
  planId: string | null;
  interval: Interval | null;
}
export interface MrrHistorySubscription {
  id: string;
  status: string;
  qty: number;
  unitPriceMinor: number;
  discountBp: number;
  planId: string;
  orderLine: Terms | null;
  transitions: {
    id: string;
    type: string;
    effectiveAt: Date;
    createdAt: Date;
    detail: unknown;
  }[];
}
export interface MrrHistoryResult {
  rows: { label: string; asOf: string; valueMinor: number }[];
  incompleteReason: string | null;
}
const intervals = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];
const stateTypes = new Set(["ACTIVATE", "PAUSED", "RESUMED", "CANCELLED"]);
const changeTypes = new Set(["QTY_CHANGED", "PLAN_CHANGED"]);
const lifecyclePriority = (type: string) =>
  type === "ACTIVATE" ? 0 : type === "RESUMED" ? 1 : 2;
const informationalTypes = new Set([
  "PAUSE_REQUESTED",
  "PAUSE_WITHDRAWN",
  "RESUME_SELECTED",
  "RESUME_CHANGED",
  "CANCEL_REQUESTED",
  "PERIOD_ADVANCED",
]);
function detailObject(detail: unknown): Record<string, unknown> {
  return detail !== null && typeof detail === "object" && !Array.isArray(detail)
    ? (detail as Record<string, unknown>)
    : {};
}
function validTerms(
  terms: Terms,
): terms is Terms & { interval: Interval; planId: string } {
  return (
    (!terms.pricingBasis ||
      (Number.isSafeInteger(terms.pricingBasis.grossMinor) &&
        Number.isSafeInteger(terms.pricingBasis.netMinor) &&
        terms.pricingBasis.netMinor >= 0 &&
        terms.pricingBasis.grossMinor >= terms.pricingBasis.netMinor)) &&
    Number.isSafeInteger(terms.qty) &&
    terms.qty > 0 &&
    Number.isSafeInteger(terms.unitPriceMinor) &&
    terms.unitPriceMinor >= 0 &&
    Number.isSafeInteger(terms.discountBp) &&
    terms.discountBp >= 0 &&
    terms.discountBp <= 10000 &&
    typeof terms.planId === "string" &&
    terms.planId.length > 0 &&
    terms.interval !== null &&
    intervals.includes(terms.interval)
  );
}

/** UTC month-end snapshots, clipped to [from, to) and now (inclusive).
 * Replay effective time, not recording time: late billing writes backdated events.
 * Current fields are used ONLY to detect incomplete history, never as past terms.
 */
export function reconstructMrrHistory(
  subscriptions: MrrHistorySubscription[],
  plans: ReadonlyMap<string, Interval>,
  period: { from: Date; to: Date },
  now: Date,
): MrrHistoryResult {
  const fail = (reason: string): MrrHistoryResult => ({
    rows: [],
    incompleteReason: `Incomplete subscription history: ${reason} Historical MRR cannot be reconstructed reliably.`,
  });
  const last = Math.min(period.to.getTime() - 1, now.getTime());
  if (last < period.from.getTime()) return { rows: [], incompleteReason: null };
  const snapshots: { label: string; asOf: Date }[] = [];
  let cursor = new Date(
    Date.UTC(period.from.getUTCFullYear(), period.from.getUTCMonth(), 1),
  );
  while (cursor.getTime() <= last) {
    const next = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    snapshots.push({
      label: cursor.toISOString().slice(0, 7),
      asOf: new Date(Math.min(next.getTime() - 1, last)),
    });
    cursor = next;
  }
  type State = Terms & { interval: Interval; status: string };
  const histories: { at: number; state: State }[][] = [];
  for (const subscription of subscriptions) {
    const initial = subscription.orderLine;
    if (!initial || !validTerms(initial))
      return fail("Immutable order-line terms are missing or invalid.");
    let state: State = { ...initial, status: "SCHEDULED" };
    const history = [{ at: -Infinity, state: { ...state } }];
    const events = subscription.transitions
      .filter((e) => e.effectiveAt <= now)
      .sort(
        (a, b) =>
          a.effectiveAt.getTime() - b.effectiveAt.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          lifecyclePriority(a.type) - lifecyclePriority(b.type) ||
          a.id.localeCompare(b.id),
      );
    if (
      subscription.status !== "SCHEDULED" &&
      !events.some((e) => e.type === "ACTIVATE")
    ) {
      return fail(
        "No activation event establishes the subscription's historical lifecycle.",
      );
    }
    for (const event of events) {
      const detail = detailObject(event.detail);
      if (changeTypes.has(event.type)) {
        // The job flips this flag only after applying deferred changes. Overdue
        // pending requests are still requests, even if their effectiveAt is past.
        if (detail.pending === true) continue;
        if (detail.pending !== false)
          return fail("A term change has no application flag.");
        const next: Terms = {
          qty: detail.newQty as number,
          unitPriceMinor: detail.newPriceMinor as number,
          planId: detail.newPlanId as string,
          interval:
            typeof detail.newPlanId === "string"
              ? (plans.get(detail.newPlanId) ?? null)
              : null,
          discountBp: initial.discountBp,
          pricingBasis: initial.pricingBasis,
        };
        if (!validTerms(next))
          return fail(
            "A term change lacks complete terms or a resolvable historical plan.",
          );
        // A deferred change can be applied after a pause, but there is no
        // appliedAt field to recover that actual application date.
        if (state.status !== "ACTIVE")
          return fail(
            "A term change has an unprovable application date or missing activation/resume event.",
          );
        state = { ...next, status: state.status };
      } else if (stateTypes.has(event.type)) {
        const expected =
          event.type === "ACTIVATE"
            ? "SCHEDULED"
            : event.type === "RESUMED"
              ? "PAUSED"
              : "ACTIVE";
        if (event.type === "CANCELLED") {
          // Cancellation of a never-activated scheduled subscription is valid.
          if (state.status === "CANCELLED")
            return fail("Cancellation events conflict.");
        } else if (state.status !== expected)
          return fail(
            "Activation, pause or resume events are missing or inconsistent.",
          );
        state = {
          ...state,
          status:
            event.type === "PAUSED"
              ? "PAUSED"
              : event.type === "CANCELLED"
                ? "CANCELLED"
                : "ACTIVE",
        };
      } else {
        if (!informationalTypes.has(event.type))
          return fail("An unsupported transition prevents reliable replay.");
        if (event.type === "PERIOD_ADVANCED" && state.status !== "ACTIVE")
          return fail(
            "A billed period has no matching active lifecycle history.",
          );
        continue;
      }
      history.push({ at: event.effectiveAt.getTime(), state: { ...state } });
    }
    const currentStatus =
      subscription.status === "PAUSE_SCHEDULED"
        ? "ACTIVE"
        : subscription.status;
    if (
      state.status !== currentStatus ||
      state.qty !== subscription.qty ||
      state.unitPriceMinor !== subscription.unitPriceMinor ||
      state.discountBp !== subscription.discountBp ||
      state.planId !== subscription.planId
    )
      return fail(
        "Replayed lifecycle or terms do not match the current subscription; source events are missing.",
      );
    histories.push(history);
  }
  if (!subscriptions.length) return { rows: [], incompleteReason: null };
  const positions = histories.map(() => 0);
  return {
    incompleteReason: null,
    rows: snapshots.map(({ label, asOf }) => ({
      label,
      asOf: asOf.toISOString(),
      valueMinor: mrr(
        histories.map((history, i) => {
          while (
            positions[i] + 1 < history.length &&
            history[positions[i] + 1].at <= asOf.getTime()
          )
            positions[i]++;
          return history[positions[i]].state;
        }),
      ),
    })),
  };
}
