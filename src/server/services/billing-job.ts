import { Prisma } from "@prisma/client";
import { prisma, withTx, lockRow } from "@/server/db";
import {
  issuePeriod,
  startSubscriptionsForOrder,
  regenerateSchedule,
} from "./subscription-billing.service";
import { processOneTransition } from "./pause-resume.service";
import {
  startBillingObservation,
  recordBillingFailure,
  finishBillingObservation,
  safeJobFailure,
  type BillingRunOptions,
  type JobFailure,
} from "./job-observation.service";
export async function runBilling(now = new Date(), options: BillingRunOptions = {}) {
  // Fail closed before business writes if a durable start cannot be recorded.
  const run = await startBillingObservation(now, options);
  const counts = {
    ordersStarted: 0,
    invoices: 0,
    transitions: 0,
    failed: [] as JobFailure[],
    observationFailures: 0,
  };
  const failed = async (error: unknown, scope: JobFailure["scope"], id: string) => {
    const failure = safeJobFailure(error, scope, id);
    counts.failed.push(failure);
    if (!(await recordBillingFailure(run, failure))) counts.observationFailures++;
  };
  let orders: { id: string }[] = [];
  try {
    orders = await prisma.order.findMany({
      where: {
        status: "OPEN",
        lines: { some: { kind: "SUBSCRIPTION", subscription: null } },
      },
      select: { id: true },
    });
  } catch (error) {
    await failed(error, "ORDER_DISCOVERY", run.runId);
  }
  for (const { id } of orders) {
    try {
      await withTx(async (tx) => {
        await lockRow(tx, "Order", id);
        await startSubscriptionsForOrder(tx, id);
      });
      counts.ordersStarted++;
    } catch (error) {
      await failed(error, "ORDER", id);
    }
  }
  let ids: { id: string }[] = [];
  try {
    ids = await prisma.subscription.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true },
    });
  } catch (error) {
    await failed(error, "SUBSCRIPTION_DISCOVERY", run.runId);
  }
  for (const { id } of ids) {
    try {
      const outcome = await withTx(
        async (tx) => {
          await lockRow(tx, "Subscription", id);
          let invoices = 0,
            transitions = 0;
          // Re-read after every event: a late run must bill earlier active periods before a later pause.
          let guard = 0;
          for (; guard < 120; guard++) {
            const s = await tx.subscription.findUniqueOrThrow({
              where: { id },
              include: { plan: true },
            });
            if (s.status === "CANCELLED") break;
            const events = [
              s.nextBillingDate,
              s.cancelEffectiveAt,
              ...(s.status === "PAUSE_SCHEDULED" ? [s.pauseEffectiveAt] : []),
              ...(s.status === "PAUSED" ? [s.resumeAt] : []),
            ]
              .filter((d): d is Date => !!d && d <= now)
              .sort((a, b) => a.getTime() - b.getTime());
            const boundary = events[0];
            if (!boundary) break;
            if (await processOneTransition(tx, s, boundary)) {
              transitions++;
              continue;
            }
            if (s.status === "PAUSED") break;
            if (s.status === "SCHEDULED") {
              if (s.activationDate > now) break;
              await tx.subscription.update({
                where: { id },
                data: { status: "ACTIVE" },
              });
              await tx.subscriptionTransition.upsert({
                where: { idempotencyKey: `${id}:ACTIVATE` },
                create: {
                  subscriptionId: id,
                  type: "ACTIVATE",
                  effectiveAt: s.activationDate,
                  actorType: "SYSTEM",
                  idempotencyKey: `${id}:ACTIVATE`,
                },
                update: {},
              });
              transitions++;
              continue;
            }
            const changes = await tx.subscriptionTransition.findMany({
              where: {
                subscriptionId: id,
                type: { in: ["QTY_CHANGED", "PLAN_CHANGED"] },
                effectiveAt: { lte: boundary },
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            });
            for (const c of changes) {
              const d = c.detail as Record<string, unknown> | null;
              if (!d?.pending) continue;
              await tx.subscription.update({
                where: { id },
                data: {
                  qty: Number(d.newQty),
                  unitPriceMinor: Number(d.newPriceMinor),
                  planId: String(d.newPlanId),
                  ...(d.differentCycle ? { billingAnchor: boundary } : {}),
                },
              });
              await tx.subscriptionTransition.update({
                where: { id: c.id },
                data: {
                  detail: { ...d, pending: false } as Prisma.InputJsonValue,
                },
              });
            }
            await issuePeriod(tx, id, boundary);
            invoices++;
          }
          await regenerateSchedule(tx, id);
          // Commit catch-up progress; a retry can continue instead of repeating
          // a transaction that will always exceed the bounded event loop.
          let limited = false;
          if (guard === 120) {
            const remaining = await tx.subscription.findUniqueOrThrow({ where: { id } });
            limited = remaining.status !== "CANCELLED" && [
              remaining.nextBillingDate,
              remaining.cancelEffectiveAt,
              ...(remaining.status === "PAUSE_SCHEDULED" ? [remaining.pauseEffectiveAt] : []),
              ...(remaining.status === "PAUSED" ? [remaining.resumeAt] : []),
            ].some((date) => date && date <= now);
          }
          return { invoices, transitions, limited };
        },
        { timeout: process.env.TEST_DATABASE_URL ? 120000 : 60000 },
      );
      counts.invoices += outcome.invoices;
      counts.transitions += outcome.transitions;
      if (outcome.limited) await failed({ code: "CATCH_UP_LIMIT" }, "SUBSCRIPTION", id);
    } catch (e) {
      await failed(e, "SUBSCRIPTION", id);
    }
  }
  const status = counts.failed.some((failure) => failure.scope.endsWith("DISCOVERY"))
    ? "FAILED" as const
    : counts.failed.length ? "PARTIAL_FAILURE" as const : "SUCCEEDED" as const;
  await finishBillingObservation(run, {
    status, ordersStarted: counts.ordersStarted, invoices: counts.invoices,
    transitions: counts.transitions, failureCount: counts.failed.length,
    observationFailures: counts.observationFailures, failures: counts.failed.slice(0, 100),
  });
  return { ...counts, runId: run.runId, status };
}
