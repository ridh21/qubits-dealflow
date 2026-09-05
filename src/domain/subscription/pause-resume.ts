import {
  boundariesFrom,
  firstBoundaryOnOrAfter,
  isBoundary,
} from "../boundaries/boundaries";
import { ValidationError } from "../errors";
import { assertDate, type Interval } from "../proration/period";

export type SubscriptionStatus =
  "SCHEDULED" | "ACTIVE" | "PAUSE_SCHEDULED" | "PAUSED" | "CANCELLED";
export interface PauseSubscription {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  billingAnchor: Date;
  plan: { interval: Interval };
}
export interface ResumeSubscription {
  billingAnchor: Date;
  interval: Interval;
  pauseEffectiveAt: Date;
}
export interface TransitionSubscription {
  status: SubscriptionStatus;
  pauseEffectiveAt?: Date | null;
  resumeAt?: Date | null;
  cancelEffectiveAt?: Date | null;
}
export type DueTransition = "PAUSE" | "RESUME" | "CANCEL_AT_BOUNDARY";
export class InvalidResume extends ValidationError {
  constructor(readonly eligible: Date[]) {
    super("Resume must follow the pause boundary and be in the future", {
      eligible,
    });
  }
}

export function planPause(
  sub: PauseSubscription,
  now: Date,
): { pauseEffectiveAt: Date } {
  assertDate(now);
  if (!["ACTIVE", "PAUSE_SCHEDULED"].includes(sub.status))
    throw new ValidationError("Only active subscriptions can schedule a pause");
  if (
    !sub.currentPeriodEnd ||
    sub.currentPeriodEnd < now ||
    !isBoundary(sub.billingAnchor, sub.plan.interval, sub.currentPeriodEnd)
  )
    throw new ValidationError(
      "Current period must end at an upcoming billing boundary",
    );
  return { pauseEffectiveAt: new Date(sub.currentPeriodEnd) };
}

export function validateResume(
  sub: ResumeSubscription,
  requested: Date,
  now: Date,
): { resumeAt: Date; adjusted: boolean } {
  assertDate(requested);
  assertDate(now);
  assertDate(sub.pauseEffectiveAt);
  const resumeAt = firstBoundaryOnOrAfter(
    sub.billingAnchor,
    sub.interval,
    requested,
  );
  if (requested <= now || resumeAt <= sub.pauseEffectiveAt || resumeAt <= now) {
    const from = new Date(
      Math.max(now.getTime(), sub.pauseEffectiveAt.getTime()) + 1,
    );
    throw new InvalidResume(
      boundariesFrom(sub.billingAnchor, sub.interval, from, 6),
    );
  }
  return { resumeAt, adjusted: resumeAt.getTime() !== requested.getTime() };
}

/** A delayed job may need both pause and resume; cancellation always wins. */
export function nextTransitions(
  sub: TransitionSubscription,
  now: Date,
): DueTransition[] {
  assertDate(now);
  if (sub.status === "CANCELLED") return [];
  if (sub.cancelEffectiveAt && sub.cancelEffectiveAt <= now)
    return ["CANCEL_AT_BOUNDARY"];
  const transitions: DueTransition[] = [];
  const pauseDue =
    sub.status === "PAUSE_SCHEDULED" &&
    !!sub.pauseEffectiveAt &&
    sub.pauseEffectiveAt <= now;
  if (pauseDue) transitions.push("PAUSE");
  if (
    (sub.status === "PAUSED" || pauseDue) &&
    sub.resumeAt &&
    sub.resumeAt <= now &&
    (!sub.cancelEffectiveAt || sub.resumeAt < sub.cancelEffectiveAt)
  )
    transitions.push("RESUME");
  return transitions;
}
