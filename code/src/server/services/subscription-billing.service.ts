import {
  Prisma,
  type Subscription,
  type SubscriptionPlan,
} from "@prisma/client";
import { prisma, withTx, lockRow, type Tx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/guards";
import { Forbidden, Conflict, ValidationError } from "@/domain/errors";
import { periodEnd } from "@/domain/proration/period";
import {
  cancellation,
  periodAmount,
  prorate,
} from "@/domain/proration/prorate";
import { pctOf } from "@/domain/money/money";
import { effectiveFor } from "@/domain/entitlements/effective";
import { issueInvoice } from "./invoice.service";
import { issueCreditNote, applyAvailableCredits } from "./credit.service";
import { getActivePolicy } from "./policy.service";
export async function currentEntitlements(tx: Tx, plan: SubscriptionPlan) {
  if (!plan.tierId) return {};
  const [defs, values] = await Promise.all([
    tx.entitlementDefinition.findMany({ where: { productId: plan.productId } }),
    tx.entitlementValue.findMany({ where: { tierId: plan.tierId } }),
  ]);
  return effectiveFor(
    defs,
    values,
    plan.tierId,
    plan.interval,
  ) as unknown as Prisma.InputJsonValue;
}
export async function startSubscriptionsForOrder(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: { where: { kind: "SUBSCRIPTION" } } },
  });
  for (const l of order.lines) {
    if (!l.planId)
      throw new ValidationError("Subscription order line has no plan.");
    const existing = await tx.subscription.findUnique({
      where: { orderLineId: l.id },
    });
    if (existing) continue;
    const sub = await tx.subscription.create({
      data: {
        orderId,
        orderLineId: l.id,
        customerId: order.customerId,
        planId: l.planId,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        discountBp: l.discountBp,
        activationDate: order.confirmedAt,
        billingAnchor: order.confirmedAt,
        nextBillingDate: order.confirmedAt,
      },
    });
    await writeAudit(tx, {
      actorType: "SYSTEM",
      entityType: "Subscription",
      entityId: sub.id,
      action: "SUBSCRIPTION.SCHEDULED",
    });
    await regenerateSchedule(tx, sub.id);
  }
}
export async function regenerateSchedule(tx: Tx, id: string) {
  const sub = await tx.subscription.findUniqueOrThrow({
      where: { id },
      include: { plan: true },
    }),
    policy = await getActivePolicy(tx, "BILLING");
  let start =
    (sub.status === "PAUSED" ? sub.pauseEffectiveAt : sub.nextBillingDate) ??
    sub.currentPeriodEnd ??
    sub.cancelEffectiveAt ??
    sub.activationDate;
  const pending = await tx.subscriptionTransition.findMany({
    where: {
      subscriptionId: id,
      type: { in: ["QTY_CHANGED", "PLAN_CHANGED"] },
      detail: { path: ["pending"], equals: true },
    },
    // Match billing-job ordering when more than one decision shares a boundary.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const applied = new Set<string>();
  const projected = {
    qty: sub.qty,
    unitPriceMinor: sub.unitPriceMinor,
    plan: sub.plan,
    billingAnchor: sub.billingAnchor,
  };
  const items: Prisma.BillingScheduleItemCreateManyInput[] = [];
  await tx.billingScheduleItem.deleteMany({
    where: {
      subscriptionId: id,
      status: { in: ["UPCOMING", "SKIPPED_PAUSED", "SKIPPED_CANCELLED"] },
    },
  });
  for (let i = 0; i < policy.payload.scheduleHorizonPeriods; i++) {
    const status =
      sub.status === "CANCELLED" ||
      (sub.cancelEffectiveAt && start >= sub.cancelEffectiveAt)
        ? "SKIPPED_CANCELLED"
        : sub.pauseEffectiveAt &&
            start >= sub.pauseEffectiveAt &&
            (!sub.resumeAt || start < sub.resumeAt)
          ? "SKIPPED_PAUSED"
          : "UPCOMING";
    // NONE changes take effect at the first billable boundary, not in the
    // current period or during skipped periods. Keep this projection read-only.
    if (status === "UPCOMING") {
      for (const change of pending) {
        if (applied.has(change.id) || change.effectiveAt > start) continue;
        const detail = change.detail as Record<string, unknown>;
        projected.qty = Number(detail.newQty);
        projected.unitPriceMinor = Number(detail.newPriceMinor);
        projected.plan = await tx.subscriptionPlan.findUniqueOrThrow({
          where: { id: String(detail.newPlanId) },
        });
        if (detail.differentCycle) projected.billingAnchor = start;
        applied.add(change.id);
      }
    }
    const end = periodEnd(
      projected.plan.interval,
      start,
      projected.billingAnchor.getUTCDate(),
    );
    items.push({
      subscriptionId: id,
      periodStart: start,
      periodEnd: end,
      amountMinor: periodAmount(
        projected.qty,
        projected.unitPriceMinor,
        sub.discountBp,
      ),
      status,
    });
    start = end;
  }
  await tx.billingScheduleItem.createMany({
    data: items,
    skipDuplicates: true,
  });
}
export async function issuePeriod(tx: Tx, id: string, start: Date) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id },
    include: { plan: true, order: true, orderLine: true },
  });
  if (!["ACTIVE", "PAUSE_SCHEDULED"].includes(sub.status))
    throw new ValidationError("Subscription is not billable.");
  const end = periodEnd(
      sub.plan.interval,
      start,
      sub.billingAnchor.getUTCDate(),
    ),
    amount = periodAmount(sub.qty, sub.unitPriceMinor, sub.discountBp),
    entitlements = await currentEntitlements(tx, sub.plan);
  const invoice = await issueInvoice(tx, {
    customerId: sub.customerId,
    orderId: sub.orderId,
    type: "RECURRING",
    currency: sub.order.currency,
    sourceKey: `SUB:${id}:${start.toISOString()}`,
    issuedAt: start,
    lines: [
      {
        description: `${sub.orderLine.productName} · ${sub.plan.name}`,
        qty: sub.qty,
        unitPriceMinor: sub.unitPriceMinor,
        amountMinor: amount,
        taxMinor: pctOf(amount, sub.orderLine.taxBp),
        subscriptionId: id,
        periodStart: start,
        periodEnd: end,
      },
    ],
  });
  await tx.billingScheduleItem.upsert({
    where: {
      subscriptionId_periodStart: { subscriptionId: id, periodStart: start },
    },
    create: {
      subscriptionId: id,
      periodStart: start,
      periodEnd: end,
      amountMinor: amount,
      status: "INVOICED",
      invoiceId: invoice.id,
      entitlements,
    },
    update: {
      periodEnd: end,
      status: "INVOICED",
      invoiceId: invoice.id,
      entitlements,
      amountMinor: amount,
    },
  });
  await tx.subscription.update({
    where: { id },
    data: {
      currentPeriodStart: start,
      currentPeriodEnd: end,
      nextBillingDate: end,
      entitlementsSnapshot: entitlements,
    },
  });
  await tx.subscriptionTransition.upsert({
    where: { idempotencyKey: `${id}:PERIOD:${start.toISOString()}` },
    create: {
      subscriptionId: id,
      type: "PERIOD_ADVANCED",
      effectiveAt: start,
      actorType: "SYSTEM",
      idempotencyKey: `${id}:PERIOD:${start.toISOString()}`,
    },
    update: {},
  });
  return invoice;
}
function requireFinance(actor: SessionUser) {
  if (!["ADMIN", "FINANCE"].includes(actor.role)) throw new Forbidden();
}
export async function setActivationDate(
  actor: SessionUser,
  id: string,
  date: Date,
) {
  requireFinance(actor);
  return withTx(async (tx) => {
    await lockRow(tx, "Subscription", id);
    const s = await tx.subscription.findUniqueOrThrow({ where: { id } });
    if (s.status !== "SCHEDULED" || date < new Date())
      throw new ValidationError(
        "Choose a future date for a scheduled subscription.",
      );
    await tx.subscription.update({
      where: { id },
      data: {
        activationDate: date,
        billingAnchor: date,
        nextBillingDate: date,
      },
    });
    await regenerateSchedule(tx, id);
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Subscription",
      entityId: id,
      action: "SUBSCRIPTION.ACTIVATION_CHANGED",
      after: { activationDate: date.toISOString() },
    });
  });
}
export async function previewChange(
  id: string,
  input: { newQty?: number; newPlanId?: string },
  now = new Date(),
) {
  const s = await prisma.subscription.findUniqueOrThrow({
      where: { id },
      include: { plan: true, orderLine: true },
    }),
    plan = input.newPlanId
      ? await prisma.subscriptionPlan.findUniqueOrThrow({
          where: { id: input.newPlanId },
        })
      : s.plan;
  return changePreview(s, plan, input.newQty ?? s.qty, s.orderLine.taxBp, now);
}
function changePreview(
  s: Subscription & { plan: SubscriptionPlan },
  plan: SubscriptionPlan,
  qty: number,
  taxBp: number,
  now: Date,
) {
  if (
    !["ACTIVE", "PAUSE_SCHEDULED"].includes(s.status) ||
    !s.currentPeriodStart ||
    !s.currentPeriodEnd ||
    now >= s.currentPeriodEnd
  )
    throw new ValidationError(
      "Run billing to bring this active subscription up to date before changing it.",
    );
  if (
    !Number.isInteger(qty) ||
    qty <= 0 ||
    !plan.isActive ||
    plan.productId !== s.plan.productId
  )
    throw new ValidationError(
      "Choose a positive quantity and active plan for this product.",
    );
  const old = periodAmount(s.qty, s.unitPriceMinor, s.discountBp),
    newPrice = plan.id === s.planId ? s.unitPriceMinor : plan.priceMinor,
    next = periodAmount(qty, newPrice, s.discountBp),
    period = { start: s.currentPeriodStart, end: s.currentPeriodEnd },
    different = plan.interval !== s.plan.interval;
  const creditMinor =
      s.plan.prorationRule === "NONE"
        ? 0
        : Math.max(0, prorate(different ? old : old - next, period, now)),
    chargeMinor =
      s.plan.prorationRule === "NONE"
        ? 0
        : different
          ? next
          : Math.max(0, prorate(next - old, period, now));
  return {
    creditMinor,
    chargeMinor,
    creditTaxMinor: pctOf(creditMinor, taxBp),
    chargeTaxMinor: pctOf(chargeMinor, taxBp),
    differentCycle: different,
    newQty: qty,
    newPlanId: plan.id,
    newPriceMinor: newPrice,
    effectiveAt: s.plan.prorationRule === "NONE" ? s.currentPeriodEnd : now,
  };
}
export async function changeSubscription(
  actor: SessionUser,
  id: string,
  input: { newQty?: number; newPlanId?: string; idempotencyKey: string },
  now = new Date(),
) {
  requireFinance(actor);
  return withTx(async (tx) => {
    await lockRow(tx, "Subscription", id);
    const existing = await tx.subscriptionTransition.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.subscriptionId !== id)
        throw new Conflict("Change key already used.");
      return existing;
    }
    const s = await tx.subscription.findUniqueOrThrow({
        where: { id },
        include: { plan: true, orderLine: true, order: true },
      }),
      plan = input.newPlanId
        ? await tx.subscriptionPlan.findUniqueOrThrow({
            where: { id: input.newPlanId },
          })
        : s.plan,
      p = changePreview(s, plan, input.newQty ?? s.qty, s.orderLine.taxBp, now);
    const transition = await tx.subscriptionTransition.create({
      data: {
        subscriptionId: id,
        type: input.newPlanId ? "PLAN_CHANGED" : "QTY_CHANGED",
        effectiveAt: p.effectiveAt,
        actorId: actor.id,
        actorType: "USER",
        idempotencyKey: input.idempotencyKey,
        detail: {
          ...p,
          effectiveAt: p.effectiveAt.toISOString(),
          pending: s.plan.prorationRule === "NONE",
        },
      },
    });
    if (s.plan.prorationRule !== "NONE") {
      if (p.creditMinor) {
        const source = await tx.invoice.findUnique({
          where: {
            sourceKey: `SUB:${id}:${s.currentPeriodStart!.toISOString()}`,
          },
        });
        await issueCreditNote(tx, {
          customerId: s.customerId,
          subscriptionId: id,
          sourceInvoiceId: source?.id,
          amountMinor: p.creditMinor + p.creditTaxMinor,
          reason: "Prorated subscription change",
          idempotencyKey: `CREDIT:${input.idempotencyKey}`,
          actorId: actor.id,
        });
        if (source) await applyAvailableCredits(tx, source.id);
      }
      // A cycle switch starts a paid period now, including its allowance snapshot.
      // Reuse the proration invoice rather than issuing a second SUB charge.
      const newPeriod = p.differentCycle
        ? {
            periodStart: now,
            periodEnd: periodEnd(plan.interval, now),
            entitlements: await currentEntitlements(tx, plan),
          }
        : null;
      const invoice =
        p.chargeMinor || newPeriod
          ? await issueInvoice(tx, {
              customerId: s.customerId,
              orderId: s.orderId,
              type: "PRORATION",
              currency: s.order.currency,
              sourceKey: `PRORATION:${input.idempotencyKey}`,
              issuedAt: now,
              lines: [
                {
                  description: "Subscription change",
                  qty: 1,
                  unitPriceMinor: p.chargeMinor,
                  amountMinor: p.chargeMinor,
                  taxMinor: p.chargeTaxMinor,
                  subscriptionId: id,
                  periodStart: now,
                  periodEnd: newPeriod?.periodEnd ?? s.currentPeriodEnd!,
                },
              ],
            })
          : null;
      await tx.subscription.update({
        where: { id },
        data: {
          qty: p.newQty,
          planId: p.newPlanId,
          unitPriceMinor: p.newPriceMinor,
          ...(newPeriod
            ? {
                billingAnchor: now,
                currentPeriodStart: newPeriod.periodStart,
                currentPeriodEnd: newPeriod.periodEnd,
                nextBillingDate: newPeriod.periodEnd,
                entitlementsSnapshot: newPeriod.entitlements,
                pauseEffectiveAt: null,
                resumeAt: null,
                status: "ACTIVE",
              }
            : {}),
        },
      });
      if (newPeriod && invoice) {
        const current = {
          ...newPeriod,
          amountMinor: p.chargeMinor,
          status: "INVOICED" as const,
          invoiceId: invoice.id,
        };
        await tx.billingScheduleItem.upsert({
          where: {
            subscriptionId_periodStart: { subscriptionId: id, periodStart: now },
          },
          create: { subscriptionId: id, ...current },
          update: current,
        });
      }
    }
    await regenerateSchedule(tx, id);
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Subscription",
      entityId: id,
      action: "SUBSCRIPTION.CHANGED",
      after: { ...p, effectiveAt: p.effectiveAt.toISOString() },
    });
    return transition;
  });
}
type CancellationMode = "END_OF_PERIOD" | "IMMEDIATE";

/** Shared preview used by both the confirmation dialog and the locked mutation. */
async function cancellationPreview(
  tx: Tx,
  id: string,
  mode: CancellationMode,
  now: Date,
) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id },
    include: { plan: true },
  });
  const policy = await getActivePolicy(tx, "BILLING");
  if (sub.status === "CANCELLED")
    throw new ValidationError("Subscription already cancelled.");
  if (mode === "IMMEDIATE" && !policy.payload.allowImmediateCancellation)
    throw new ValidationError(
      "Policy permits cancellation at period end only.",
    );
  const effectiveAt =
    mode === "END_OF_PERIOD" ? (sub.currentPeriodEnd ?? now) : now;
  const credits: { sourceInvoiceId: string; amountMinor: number }[] = [];
  if (
    mode === "END_OF_PERIOD" ||
    !sub.currentPeriodStart ||
    !sub.currentPeriodEnd ||
    sub.plan.cancellationRule === "NONE"
  )
    return { effectiveAt, creditMinor: 0, credits, customerId: sub.customerId };
  const sources = await tx.invoice.findMany({
    where: {
      status: "ISSUED",
      lines: { some: { subscriptionId: id, periodEnd: sub.currentPeriodEnd } },
    },
    orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
  });
  const line = await tx.orderLine.findUniqueOrThrow({
    where: { id: sub.orderLineId },
  });
  const net = periodAmount(sub.qty, sub.unitPriceMinor, sub.discountBp);
  let remaining = cancellation(
    {
      periodAmount: net + pctOf(net, line.taxBp),
      period: { start: sub.currentPeriodStart, end: sub.currentPeriodEnd },
      rule: sub.plan.cancellationRule,
      invoiced: sources.length > 0,
      mode,
    },
    now,
  ).creditMinor;
  for (const source of sources) {
    const credited = await tx.creditNote.aggregate({
      where: { sourceInvoiceId: source.id },
      _sum: { amountMinor: true },
    });
    const available = Math.max(
      0,
      source.totalMinor - (credited._sum.amountMinor ?? 0),
    );
    const amountMinor = Math.min(remaining, available);
    if (amountMinor > 0)
      credits.push({ sourceInvoiceId: source.id, amountMinor });
    remaining -= amountMinor;
  }
  return {
    effectiveAt,
    creditMinor: credits.reduce((sum, credit) => sum + credit.amountMinor, 0),
    credits,
    customerId: sub.customerId,
  };
}

export async function previewCancel(
  id: string,
  mode: CancellationMode,
  now = new Date(),
) {
  return cancellationPreview(prisma, id, mode, now);
}

export async function cancelSubscription(
  actor: SessionUser,
  id: string,
  input: {
    mode: "END_OF_PERIOD" | "IMMEDIATE";
    reason: string;
    idempotencyKey: string;
  },
  now = new Date(),
) {
  requireFinance(actor);
  return withTx(async (tx) => {
    await lockRow(tx, "Subscription", id);
    const existing = await tx.subscriptionTransition.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.subscriptionId !== id)
        throw new Conflict("Cancellation key already used.");
      return existing;
    }
    const preview = await cancellationPreview(tx, id, input.mode, now);
    const effective = preview.effectiveAt;
    for (const credit of preview.credits) {
      await issueCreditNote(tx, {
        customerId: preview.customerId,
        subscriptionId: id,
        ...credit,
        reason: input.reason,
        idempotencyKey: `CANCEL:${input.idempotencyKey}:${credit.sourceInvoiceId}`,
        actorId: actor.id,
      });
      await applyAvailableCredits(tx, credit.sourceInvoiceId);
    }
    await tx.subscription.update({
      where: { id },
      data: {
        cancelEffectiveAt: effective,
        resumeAt: null,
        ...(effective <= now
          ? { status: "CANCELLED", cancelledAt: now, nextBillingDate: null }
          : {}),
      },
    });
    const row = await tx.subscriptionTransition.create({
      data: {
        subscriptionId: id,
        type: effective <= now ? "CANCELLED" : "CANCEL_REQUESTED",
        effectiveAt: effective,
        actorId: actor.id,
        actorType: "USER",
        idempotencyKey: input.idempotencyKey,
        detail: { mode: input.mode, reason: input.reason },
      },
    });
    await regenerateSchedule(tx, id);
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Subscription",
      entityId: id,
      action: "SUBSCRIPTION.CANCELLATION_REQUESTED",
      reason: input.reason,
    });
    return row;
  });
}
