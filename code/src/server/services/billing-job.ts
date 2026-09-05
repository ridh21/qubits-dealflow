import { Prisma } from "@prisma/client";
import { prisma, withTx, lockRow } from "@/server/db";
import {
  issuePeriod,
  startSubscriptionsForOrder,
  regenerateSchedule,
} from "./subscription-billing.service";
import { processOneTransition } from "./pause-resume.service";
import { writeAudit } from "@/server/audit";
export async function runBilling(now = new Date()) {
  const counts = {
    invoices: 0,
    transitions: 0,
    failed: [] as { id: string; message: string }[],
  };
  const orders = await prisma.order.findMany({
    where: {
      status: "OPEN",
      lines: { some: { kind: "SUBSCRIPTION", subscription: null } },
    },
    select: { id: true },
  });
  for (const o of orders)
    await withTx(async (tx) => {
      await lockRow(tx, "Order", o.id);
      await startSubscriptionsForOrder(tx, o.id);
    });
  const ids = await prisma.subscription.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { id: true },
  });
  for (const { id } of ids) {
    try {
      const outcome = await withTx(
        async (tx) => {
          await lockRow(tx, "Subscription", id);
          let invoices = 0,
            transitions = 0;
          // Re-read after every event: a late run must bill earlier active periods before a later pause.
          for (let guard = 0; guard < 120; guard++) {
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
          return { invoices, transitions };
        },
        { timeout: process.env.TEST_DATABASE_URL ? 120000 : 60000 },
      );
      counts.invoices += outcome.invoices;
      counts.transitions += outcome.transitions;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Billing failed";
      counts.failed.push({ id, message });
      await withTx((tx) =>
        writeAudit(tx, {
          actorType: "SYSTEM",
          entityType: "Subscription",
          entityId: id,
          action: "BILLING.FAILED",
          reason: message.slice(0, 1000),
        }),
      );
    }
  }
  return counts;
}
