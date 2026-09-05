import {
  Prisma,
  type Subscription,
  type SubscriptionPlan,
} from "@prisma/client";
import { withTx, lockRow, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Forbidden, Conflict, ValidationError } from "@/domain/errors";
import { planPause, validateResume } from "@/domain/subscription/pause-resume";
import { getActivePolicy } from "./policy.service";
import { regenerateSchedule } from "./subscription-billing.service";
import { writeAudit } from "@/server/audit";
import { notifyUser } from "./notification.service";
async function authorize(tx: Tx, actor: SessionUser, id: string) {
  await lockRow(tx, "Subscription", id);
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id },
    include: { plan: true },
  });
  if (actor.role === "CUSTOMER") {
    if (sub.customerId !== actor.customerId) throw new Forbidden();
    if (!(await getActivePolicy(tx, "PORTAL")).payload.allowCustomerPauseResume)
      throw new Forbidden("Self-service pauses are disabled.");
  } else if (!["ADMIN", "FINANCE"].includes(actor.role)) throw new Forbidden();
  return sub;
}
export async function changePause(
  actor: SessionUser,
  id: string,
  input: {
    action: "PAUSE" | "RESUME" | "WITHDRAW";
    requestedDate?: Date;
    idempotencyKey: string;
  },
  now = new Date(),
) {
  return withTx(async (tx) => {
    const sub = await authorize(tx, actor, id),
      existing = await tx.subscriptionTransition.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
    if (existing) {
      if (existing.subscriptionId !== id)
        throw new Conflict("Transition key already used.");
      return existing;
    }
    let effectiveAt: Date,
      type:
        | "PAUSE_REQUESTED"
        | "RESUME_SELECTED"
        | "RESUME_CHANGED"
        | "PAUSE_WITHDRAWN",
      detail: Prisma.InputJsonValue = {};
    if (input.action === "PAUSE") {
      effectiveAt = planPause(sub, now).pauseEffectiveAt;
      type = "PAUSE_REQUESTED";
      await tx.subscription.update({
        where: { id },
        data: {
          status: "PAUSE_SCHEDULED",
          pauseRequestedAt: now,
          pauseEffectiveAt: effectiveAt,
        },
      });
    } else if (input.action === "RESUME") {
      if (
        !["PAUSED", "PAUSE_SCHEDULED"].includes(sub.status) ||
        !sub.pauseEffectiveAt ||
        !input.requestedDate
      )
        throw new ValidationError(
          "Schedule a pause and choose a future resume date.",
        );
      const selected = validateResume(
        {
          billingAnchor: sub.billingAnchor,
          interval: sub.plan.interval,
          pauseEffectiveAt: sub.pauseEffectiveAt,
        },
        input.requestedDate,
        now,
      );
      effectiveAt = selected.resumeAt;
      type = sub.resumeAt ? "RESUME_CHANGED" : "RESUME_SELECTED";
      detail = { adjusted: selected.adjusted };
      await tx.subscription.update({
        where: { id },
        data: {
          resumeAt: effectiveAt,
          ...(sub.status === "PAUSED" ? { nextBillingDate: effectiveAt } : {}),
        },
      });
    } else {
      if (
        sub.status !== "PAUSE_SCHEDULED" ||
        !sub.pauseEffectiveAt ||
        sub.pauseEffectiveAt <= now
      )
        throw new ValidationError("Only a future pause can be withdrawn.");
      effectiveAt = now;
      type = "PAUSE_WITHDRAWN";
      await tx.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          pauseRequestedAt: null,
          pauseEffectiveAt: null,
          resumeAt: null,
        },
      });
    }
    const row = await tx.subscriptionTransition.create({
      data: {
        subscriptionId: id,
        type,
        effectiveAt,
        actorId: actor.id,
        actorType: actor.role === "CUSTOMER" ? "CUSTOMER" : "USER",
        idempotencyKey: input.idempotencyKey,
        detail,
      },
    });
    await regenerateSchedule(tx, id);
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: actor.role === "CUSTOMER" ? "CUSTOMER" : "USER",
      entityType: "Subscription",
      entityId: id,
      action: `SUBSCRIPTION.${type}`,
      after: { effectiveAt: effectiveAt.toISOString() },
    });
    await notifyUser(tx, actor.id, {
      type,
      title: "Subscription schedule updated",
      body: `${type.toLowerCase().replaceAll("_", " ")} effective ${effectiveAt.toISOString().slice(0, 10)}.`,
      href:
        actor.role === "CUSTOMER"
          ? `/portal/subscriptions/${id}`
          : `/subscriptions/${id}`,
    });
    return row;
  });
}
/** Called at each chronological event boundary, before an invoice for that boundary. */
export async function processOneTransition(
  tx: Tx,
  s: Subscription & { plan: SubscriptionPlan },
  boundary: Date,
) {
  let type: "CANCELLED" | "PAUSED" | "RESUMED" | undefined;
  if (s.cancelEffectiveAt && s.cancelEffectiveAt <= boundary) {
    type = "CANCELLED";
    await tx.subscription.update({
      where: { id: s.id },
      data: {
        status: "CANCELLED",
        cancelledAt: s.cancelEffectiveAt,
        nextBillingDate: null,
        resumeAt: null,
      },
    });
  } else if (
    s.status === "PAUSE_SCHEDULED" &&
    s.pauseEffectiveAt &&
    s.pauseEffectiveAt <= boundary
  ) {
    type = "PAUSED";
    await tx.subscription.update({
      where: { id: s.id },
      data: {
        status: "PAUSED",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextBillingDate: s.resumeAt,
      },
    });
  } else if (s.status === "PAUSED" && s.resumeAt && s.resumeAt <= boundary) {
    type = "RESUMED";
    await tx.subscription.update({
      where: { id: s.id },
      data: {
        status: "ACTIVE",
        nextBillingDate: s.resumeAt,
        pauseEffectiveAt: null,
        pauseRequestedAt: null,
        resumeAt: null,
      },
    });
  }
  if (type) {
    const key = `${s.id}:${type}:${boundary.toISOString()}`;
    await tx.subscriptionTransition.upsert({
      where: { idempotencyKey: key },
      create: {
        subscriptionId: s.id,
        type,
        effectiveAt: boundary,
        actorType: "SYSTEM",
        idempotencyKey: key,
      },
      update: {},
    });
    await writeAudit(tx, {
      actorType: "SYSTEM",
      entityType: "Subscription",
      entityId: s.id,
      action: `SUBSCRIPTION.${type}`,
      after: { effectiveAt: boundary.toISOString() },
    });
    return true;
  }
  return false;
}
