import { Prisma } from "@prisma/client";
import { withTx, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import {
  Conflict,
  Forbidden,
  NotFound,
  ValidationError,
} from "@/domain/errors";
import { validateForSubmission } from "@/domain/pricing/validate-submission";
import { simulateDiscountRisk } from "@/domain/risk/evaluate";
import { getActivePolicy, getPolicyVersion } from "./policy.service";
import { parsePolicy } from "@/domain/policy/validate-discount-risk";
import {
  lockedQuote,
  assertEditable,
  snapshotVersion,
  createRevision,
} from "./quotation.service";
import { repriceQuotation } from "./quotation-pricing";
import { writeAudit } from "@/server/audit";
import { notifyRole, notifyUser } from "./notification.service";
export async function evaluateAndRoute(
  tx: Tx,
  actor: SessionUser,
  id: string,
  reason: string,
) {
  const q = await tx.quotation.findUniqueOrThrow({
    where: { id },
    include: { customer: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  assertEditable(q, actor);
  const priced = await repriceQuotation(tx, id),
    policy = await getActivePolicy(tx, "DISCOUNT_RISK");
  const validation = validateForSubmission(priced, policy.payload, {
    hasActivePolicy: true,
    linesMissingCost: [],
    categoryCeilingsBp: policy.payload.categoryCeilingsBp,
  });
  if (!validation.ok)
    throw new ValidationError(
      validation.errors.map((e) => e.message).join(" "),
    );
  if (q.validUntil && q.validUntil <= new Date())
    throw new ValidationError("Set a future validity date before submission.");
  const risk = simulateDiscountRisk(policy.payload, {
    tier: q.customer.tier,
    orderDiscountBp: q.orderDiscountBp,
    lines: q.lines.map((l) => ({
      id: l.id,
      categoryId: l.categoryId,
      baseMinor: l.qty * l.unitPriceMinor,
      discountBp: l.discountBp,
      cycle: l.interval ?? "ONE_TIME",
    })),
  });
  const band =
      risk.requiredLevel === 0
        ? "LOW"
        : risk.requiredLevel === 1
          ? "MEDIUM"
          : "HIGH",
    version = q.version + 1;
  await tx.approvalStep.updateMany({
    where: { request: { quotationId: id, status: "PENDING" } },
    data: { status: "SUPERSEDED" },
  });
  await tx.approvalRequest.updateMany({
    where: { quotationId: id, status: "PENDING" },
    data: { status: "SUPERSEDED" },
  });
  await tx.quotation.update({
    where: { id },
    data: {
      version,
      riskBand: band,
      requiredLevel: risk.requiredLevel,
      riskMetrics: risk as unknown as Prisma.InputJsonValue,
      policyVersionId: policy.id,
      status: risk.requiredLevel ? "PENDING_APPROVAL" : "APPROVED",
      approvedVersion: risk.requiredLevel ? null : version,
      lastActivityAt: new Date(),
    },
  });
  await snapshotVersion(tx, id, actor, reason);
  let requestId: string | undefined;
  if (risk.requiredLevel) {
    const request = await tx.approvalRequest.create({
      data: {
        quotationId: id,
        quotationVersion: version,
        policyVersionId: policy.id,
        requiredLevel: risk.requiredLevel,
        riskBand: band,
        metrics: risk.buckets as unknown as Prisma.InputJsonValue,
        explanation: risk.explanations,
        steps: {
          create: risk.route.map((role, index) => ({
            index,
            role,
            status: index === 0 ? "PENDING" : "WAITING",
            dueAt:
              index === 0
                ? new Date(
                    Date.now() + policy.payload.slaHoursByRole[role] * 3600000,
                  )
                : null,
          })),
        },
      },
    });
    requestId = request.id;
    await notifyRole(
      tx,
      risk.route[0],
      {
        type: "APPROVAL_PENDING",
        title: `Review ${q.number}`,
        body: `${q.number} v${version} requires your review.`,
        href: `/approvals/${request.id}`,
      },
      q.ownerId,
    );
  }
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: "USER",
    entityType: "Quotation",
    entityId: id,
    action: risk.requiredLevel
      ? "QUOTATION.SUBMITTED"
      : "QUOTATION.AUTO_APPROVED",
    version,
    after: risk as unknown as Prisma.InputJsonValue,
    reason,
  });
  return {
    outcome: risk.requiredLevel
      ? ("PENDING" as const)
      : ("AUTO_APPROVED" as const),
    requestId,
    requiredLevel: risk.requiredLevel,
    band,
    steps: risk.route,
    policyVersion: policy.version,
  };
}
export async function submitForApproval(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
) {
  return withTx(async (tx) => {
    await lockedQuote(tx, id, expectedVersion);
    return evaluateAndRoute(tx, actor, id, "SUBMIT");
  });
}
export async function withdraw(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
  reason: string,
) {
  return createRevision(actor, { id, expectedVersion, reason });
}
export async function decideStep(
  actor: SessionUser,
  stepId: string,
  decision: "APPROVE" | "REJECT" | "RETURN",
  expectedVersion: number,
  note?: string,
) {
  if (!["ADMIN", "SALES_MANAGER", "FINANCE"].includes(actor.role))
    throw new Forbidden();
  if (decision !== "APPROVE" && !note?.trim())
    throw new ValidationError(
      "Explain why you are rejecting or returning this quotation.",
    );
  return withTx(async (tx) => {
    const initial = await tx.approvalStep.findUnique({
      where: { id: stepId },
      include: { request: true },
    });
    if (!initial) throw new NotFound();
    const q = await lockedQuote(
      tx,
      initial.request.quotationId,
      expectedVersion,
    );
    const step = await tx.approvalStep.findUniqueOrThrow({
        where: { id: stepId },
        include: {
          request: { include: { steps: { orderBy: { index: "asc" } } } },
        },
      }),
      request = step.request;
    if (request.quotationVersion !== q.version)
      throw new Conflict("This review is for an obsolete quotation version.");
    if (
      q.status !== "PENDING_APPROVAL" ||
      request.status !== "PENDING" ||
      step.status !== "PENDING" ||
      step.index !== request.currentStepIndex
    )
      throw new Forbidden("This is not the current approval step.");
    if (actor.role !== "ADMIN" && actor.role !== step.role)
      throw new Forbidden(
        "This approval step requires a different reviewer role.",
      );
    if (actor.id === q.ownerId)
      throw new Forbidden("You cannot approve your own quotation.");
    const policy = parsePolicy(
        "DISCOUNT_RISK",
        (await getPolicyVersion(request.policyVersionId, tx)).payload,
      ),
      now = new Date();
    await tx.approvalStep.update({
      where: { id: step.id },
      data: {
        status:
          decision === "APPROVE"
            ? "APPROVED"
            : decision === "REJECT"
              ? "REJECTED"
              : "RETURNED",
        decidedById: actor.id,
        decidedAt: now,
        note: note?.trim() || null,
      },
    });
    const next = request.steps.find((s) => s.index === step.index + 1);
    if (decision === "APPROVE" && next) {
      await tx.approvalStep.update({
        where: { id: next.id },
        data: {
          status: "PENDING",
          dueAt: new Date(
            now.getTime() + policy.slaHoursByRole[next.role] * 3600000,
          ),
        },
      });
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { currentStepIndex: next.index },
      });
      await notifyRole(
        tx,
        next.role,
        {
          type: "APPROVAL_PENDING",
          title: `Review ${q.number}`,
          body: `The preceding reviewer cleared ${q.number}. Your review is next.`,
          href: `/approvals/${request.id}`,
        },
        q.ownerId,
      );
    } else {
      const status =
        decision === "APPROVE"
          ? "APPROVED"
          : decision === "REJECT"
            ? "REJECTED"
            : "RETURNED";
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status, decidedAt: now },
      });
      await tx.quotation.update({
        where: { id: q.id },
        data: {
          status: status === "RETURNED" ? "REVISION_REQUESTED" : status,
          approvedVersion: status === "APPROVED" ? q.version : null,
          lastActivityAt: now,
        },
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "ApprovalStep",
      entityId: stepId,
      action: `APPROVAL.${decision}`,
      version: q.version,
      reason: note,
      after: {
        role: step.role,
        decision,
        policyVersionId: request.policyVersionId,
      },
    });
    await notifyUser(tx, q.ownerId, {
      type: "APPROVAL_DECISION",
      title: `${q.number}: ${decision.toLowerCase()}`,
      body:
        note ||
        `${step.role.toLowerCase().replaceAll("_", " ")} approved this step.`,
      href: `/quotations/${q.id}`,
    });
    return { requestId: request.id, quotationId: q.id };
  });
}
