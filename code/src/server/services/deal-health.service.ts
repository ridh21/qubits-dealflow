import { Prisma } from "@prisma/client";
import { withTx, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Forbidden, NotFound, ValidationError } from "@/domain/errors";
import { detectStalled } from "@/domain/health/stalled";
import { detectSlippage } from "@/domain/health/slippage";
import { repBaseline, detectDiscountAnomaly } from "@/domain/health/anomaly";
import { DAY_MS, type HealthFinding } from "@/domain/health/types";
import { ratioBp } from "@/domain/money/money";
import { getActivePolicy } from "./policy.service";
import { notifyRole, notifyUser } from "./notification.service";
import { writeAudit } from "@/server/audit";

function assertManager(actor: SessionUser) {
  if (!["ADMIN", "SALES_MANAGER", "FINANCE"].includes(actor.role))
    throw new Forbidden();
}
/** A single transaction serializes scans, including nullable alert keys. */
async function scanLock(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('deal-health-scan'))`;
}
export async function collectFindings(tx: Tx, now: Date, quotationId?: string) {
  const policy = (await getActivePolicy(tx, "DEAL_HEALTH")).payload;
  const [quotes, orders, submissions] = await Promise.all([
    tx.quotation.findMany({
      where: {
        id: quotationId,
        status: { notIn: ["CONFIRMED", "CANCELLED", "EXPIRED", "REJECTED"] },
      },
      include: {
        lines: { select: { productName: true, effectiveDiscountBp: true } },
        owner: { select: { name: true } },
      },
    }),
    tx.order.findMany({
      where: { status: "OPEN", ...(quotationId ? { id: { in: [] } } : {}) },
      include: {
        lines: {
          include: {
            backorders: {
              where: { status: { in: ["OPEN", "CONSOLIDATION_SUGGESTED"] } },
            },
          },
        },
      },
    }),
    tx.quotationVersion.findMany({
      where: {
        createdAt: {
          gte: new Date(now.getTime() - policy.anomalyLookbackDays * DAY_MS),
        },
        reason: {
          in: ["SUBMIT", "PROPOSAL_APPLIED", "PROPOSALS_AUTO_APPLIED"],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { quotationId: true, snapshot: true, createdAt: true },
    }),
  ]);
  const history = submissions.flatMap((v) => {
    const s = v.snapshot as Record<string, unknown>;
    if (
      typeof s.ownerId !== "string" ||
      typeof s.subtotalMinor !== "number" ||
      typeof s.discountMinor !== "number" ||
      s.subtotalMinor <= 0
    )
      return [];
    return [
      {
        quotationId: v.quotationId,
        ownerId: s.ownerId,
        submittedAt: v.createdAt,
        effectiveDiscountBp: ratioBp(s.discountMinor, s.subtotalMinor),
      },
    ];
  });
  const findings: HealthFinding[] = detectStalled(
    quotes,
    now,
    policy.stalledDays,
  );
  const insufficientHistory: {
    quotationId: string;
    number: string;
    samples: number;
  }[] = [];
  for (const q of quotes.filter(
    (q) => !["DRAFT", "REVISION_REQUESTED"].includes(q.status),
  )) {
    // One prior submitted quotation per baseline sample, excluding the subject.
    const submittedAt =
      history.find((h) => h.quotationId === q.id)?.submittedAt ?? now;
    const seen = new Set<string>();
    const prior = history.filter((h) => {
      if (
        h.quotationId === q.id ||
        h.submittedAt >= submittedAt ||
        seen.has(h.quotationId)
      )
        return false;
      seen.add(h.quotationId);
      return true;
    });
    const baseline = repBaseline(
      prior,
      q.ownerId,
      now,
      policy.anomalyLookbackDays,
    );
    const result = detectDiscountAnomaly(
      {
        id: q.id,
        overallDiscountBp:
          q.subtotalMinor > 0 ? ratioBp(q.discountMinor, q.subtotalMinor) : 0,
        worstLine: q.lines.length
          ? {
              label: [...q.lines].sort(
                (a, b) => b.effectiveDiscountBp - a.effectiveDiscountBp,
              )[0].productName,
              effectiveDiscountBp: Math.max(
                ...q.lines.map((l) => l.effectiveDiscountBp),
              ),
            }
          : undefined,
      },
      baseline,
      {
        minDeltaBp: policy.anomalyMinDeltaBp,
        minSamples: policy.anomalyMinSamples,
      },
    );
    if (result.alert) findings.push(result.alert);
    if (result.reason === "INSUFFICIENT_HISTORY")
      insufficientHistory.push({
        quotationId: q.id,
        number: q.number,
        samples: baseline.n,
      });
  }
  const replenishments = await tx.replenishmentPlan.findMany({
    where: {
      status: "PLANNED",
      productId: {
        in: orders.flatMap((o) =>
          o.lines.filter((l) => l.backorders.length).map((l) => l.productId),
        ),
      },
    },
    orderBy: { eta: "asc" },
  });
  const delivery = orders.map((o) => {
    const physical = o.lines.filter((l) => l.kind === "PHYSICAL");
    const backordered = physical.filter((l) => l.backorders.length);
    // Each backordered product must have coverage. A single early shipment for
    // another product cannot hide a missing or late replenishment.
    const coverage = backordered.map((l) => {
      let remaining = l.backorders.reduce((sum, b) => sum + b.qty, 0);
      for (const r of replenishments.filter(
        (r) => r.productId === l.productId,
      )) {
        remaining -= r.qty;
        if (remaining <= 0) return r.eta;
      }
      return null;
    });
    return {
      id: o.id,
      promisedDeliveryDate: o.promisedDeliveryDate,
      unshippedQty: physical.reduce((sum, l) => sum + l.qty - l.qtyShipped, 0),
      openBackorderQty: backordered.reduce(
        (sum, l) => sum + l.backorders.reduce((n, b) => n + b.qty, 0),
        0,
      ),
      earliestReplenishmentEta:
        coverage.length && !coverage.includes(null)
          ? new Date(Math.max(...coverage.map((d) => d!.getTime())))
          : null,
    };
  });
  findings.push(...detectSlippage(delivery, now, policy.slippageWindowDays));
  if (policy.approvalSlaAlerts) {
    const steps = await tx.approvalStep.findMany({
      where: {
        status: "PENDING",
        dueAt: { lt: now },
        request: {
          quotationId,
          status: "PENDING",
          quotation: { status: "PENDING_APPROVAL" },
        },
      },
      include: { request: true },
    });
    for (const step of steps)
      findings.push({
        type: "APPROVAL_SLA",
        quotationId: step.request.quotationId,
        severity: "HIGH",
        detail: {
          label: `${step.role.toLowerCase().replaceAll("_", " ")} review overdue`,
          stepId: step.id,
          requestId: step.requestId,
          dueAt: step.dueAt!.toISOString(),
        },
      });
  }
  return { findings, insufficientHistory };
}
export async function runDetectors(now = new Date(), quotationId?: string) {
  return withTx(
    async (tx) => {
      await scanLock(tx);
      const { findings, insufficientHistory } = await collectFindings(
        tx,
        now,
        quotationId,
      );
      const existing = await tx.dealHealthAlert.findMany({
        where: quotationId ? { quotationId } : {},
      });
      const seen = new Set<string>();
      let created = 0,
        resolved = 0;
      const key = (item: {
        type: string;
        quotationId?: string | null;
        orderId?: string | null;
      }) => `${item.type}:${item.quotationId ?? ""}:${item.orderId ?? ""}`;
      for (const finding of findings) {
        const identity = key(finding);
        seen.add(identity);
        const previous = existing.find((a) => key(a) === identity);
        const detail = finding.detail as Prisma.InputJsonValue;
        if (previous) {
          await tx.dealHealthAlert.update({
            where: { id: previous.id },
            data: {
              detail,
              severity: finding.severity,
              ...(previous.status === "RESOLVED"
                ? { status: "OPEN", resolvedAt: null, flaggedAt: now }
                : {}),
            },
          });
          continue;
        }
        const alert = await tx.dealHealthAlert.create({
          data: { ...finding, detail, flaggedAt: now },
        });
        created++;
        await writeAudit(tx, {
          actorType: "SYSTEM",
          entityType: "DealHealthAlert",
          entityId: alert.id,
          action: "ALERT.CREATED",
          after: detail,
        });
        const notice = {
          type: "DEAL_HEALTH",
          title: "Deal needs attention",
          body: finding.detail.label,
          href: "/deal-health",
        };
        await notifyRole(tx, "SALES_MANAGER", notice);
        if (finding.type === "DELIVERY_SLIPPAGE")
          await notifyRole(tx, "FINANCE", notice);
      }
      for (const alert of existing) {
        if (alert.status !== "RESOLVED" && !seen.has(key(alert))) {
          await tx.dealHealthAlert.update({
            where: { id: alert.id },
            data: {
              status: "RESOLVED",
              resolvedAt: now,
              lastAction: "Condition cleared",
              lastActionAt: now,
            },
          });
          await writeAudit(tx, {
            actorType: "SYSTEM",
            entityType: "DealHealthAlert",
            entityId: alert.id,
            action: "ALERT.AUTO_RESOLVED",
          });
          resolved++;
        }
      }
      return {
        created,
        resolved,
        detected: findings.length,
        insufficientHistory,
      };
    },
    { timeout: process.env.TEST_DATABASE_URL ? 180000 : 60000 },
  );
}
export async function actOnAlert(
  actor: SessionUser,
  id: string,
  action: "NUDGE" | "ESCALATE" | "RESOLVE",
  note: string,
) {
  assertManager(actor);
  if (!note.trim()) throw new ValidationError("Add a reason for this action.");
  return withTx(async (tx) => {
    await scanLock(tx);
    const alert = await tx.dealHealthAlert.findUnique({
      where: { id },
      include: {
        quotation: { select: { ownerId: true } },
        order: { include: { quotation: { select: { ownerId: true } } } },
      },
    });
    if (!alert) throw new NotFound();
    const notice = {
      type: "DEAL_HEALTH",
      title: "Deal follow-up requested",
      body: note,
      href: alert.quotationId
        ? `/quotations/${alert.quotationId}`
        : `/fulfillment/${alert.orderId}`,
    };
    if (action === "NUDGE") {
      const owner = alert.quotation?.ownerId ?? alert.order?.quotation.ownerId;
      if (owner) await notifyUser(tx, owner, notice);
    }
    if (action === "ESCALATE") {
      await notifyRole(tx, "SALES_MANAGER", notice);
      if (alert.severity === "HIGH") await notifyRole(tx, "FINANCE", notice);
    }
    await tx.dealHealthAlert.update({
      where: { id },
      data: {
        status:
          action === "NUDGE"
            ? "NUDGED"
            : action === "ESCALATE"
              ? "ESCALATED"
              : "RESOLVED",
        lastAction:
          action === "NUDGE"
            ? "Nudge sent"
            : action === "ESCALATE"
              ? "Escalated"
              : "Resolved manually",
        lastActionAt: new Date(),
        resolvedAt: action === "RESOLVE" ? new Date() : null,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "DealHealthAlert",
      entityId: id,
      action: `ALERT.${action}`,
      reason: note,
    });
  });
}

export const runForQuotation = (id: string, now = new Date()) =>
  runDetectors(now, id);
