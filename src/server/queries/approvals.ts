import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireInternal, type SessionUser } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
import {
  orderByOf,
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";

/**
 * Who may see an approval request.
 *
 * Deliberately NOT `quotationScope`. That scopes by who *owns* the quotation,
 * which is the wrong question for a review queue: a manager on another team
 * would never see a request routed to their role, and the deal would sit
 * pending with nobody able to act on it and no signal that anything was wrong.
 *
 * A reviewer sees a request because it is routed to them. Sales reps keep the
 * ownership scope — they can watch their own deal being reviewed, but the page
 * offers them no actions, and `decideStep` refuses their role outright.
 */
export function approvalScope(
  actor: SessionUser,
): Prisma.ApprovalRequestWhereInput {
  if (actor.role === "ADMIN" || actor.role === "FINANCE") return {};
  if (actor.role === "SALES_MANAGER")
    return {
      OR: [
        { quotation: quotationScope(actor) },
        { steps: { some: { role: "SALES_MANAGER" } } },
      ],
    };
  return { quotation: quotationScope(actor) };
}

const ApprovalFilters = z.object({
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "RETURNED", "SUPERSEDED"])
    .optional(),
  riskBand: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export async function listApprovals(sp: SearchParamsRecord) {
  const actor = await requireInternal();
  const p = parseListParams(sp, ApprovalFilters);

  const where: Prisma.ApprovalRequestWhereInput = {
    AND: [
      approvalScope(actor),
      ...(p.q
        ? [
            {
              quotation: {
                OR: [
                  { number: { contains: p.q, mode: "insensitive" as const } },
                  {
                    customer: {
                      name: { contains: p.q, mode: "insensitive" as const },
                    },
                  },
                ],
              },
            },
          ]
        : []),
    ],
    ...(p.filters.status ? { status: p.filters.status } : {}),
    ...(p.filters.riskBand ? { riskBand: p.filters.riskBand } : {}),
  };

  const orderBy = orderByOf(p.sort, p.dir, ["createdAt", "status", "riskBand"], {
    createdAt: "desc",
  });

  const result = await paginate(
    () => prisma.approvalRequest.count({ where }),
    (skip, take) =>
      prisma.approvalRequest.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          quotation: {
            include: { customer: { select: { name: true } } },
          },
          steps: { orderBy: { index: "asc" } },
        },
      }),
    p,
  );
  // The rows mean different things to different viewers, so the actor travels
  // with them (see domain/approval/reviewer-state).
  return { ...result, params: p, actor };
}
export async function getApproval(id: string) {
  const actor = await requireInternal();
  const request = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id }, approvalScope(actor)] },
    include: {
      quotation: {
        include: { customer: { select: { name: true } }, versions: true },
      },
      steps: { orderBy: { index: "asc" } },
    },
  });
  if (!request) throw new NotFound("Review unavailable in your scope.");
  const policy = await prisma.policyVersion.findUniqueOrThrow({
    where: { id: request.policyVersionId },
  });
  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: request.quotationId },
        { entityId: { in: request.steps.map((s) => s.id) } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  // A customer can accept while approval is still running. The reviewer needs
  // to know, because then the final approval confirms the order outright
  // rather than sending the quote back out.
  const customerAccepted = Boolean(
    await prisma.quoteAcceptance.findUnique({
      where: {
        quotationId_version: {
          quotationId: request.quotationId,
          version: request.quotationVersion,
        },
      },
      select: { id: true },
    }),
  );
  // A step can be routed to a role that has nobody able to act on it: the only
  // holder of that role owns the quotation, or the role has no active user at
  // all. That leaves a dead Approve button and a quotation that sits pending
  // forever, so the page says so instead.
  const pendingStep = request.steps.find((s) => s.status === "PENDING");
  // Anyone who could clear this step. Owning the quotation is no longer a bar,
  // so the owner counts too; zero on both means the step is genuinely stuck.
  const routedReviewers = pendingStep
    ? await prisma.user.count({
        where: { isActive: true, role: pendingStep.role },
      })
    : 0;
  const adminsAvailable = pendingStep
    ? await prisma.user.count({ where: { isActive: true, role: "ADMIN" } })
    : 0;

  return {
    actor,
    request,
    policy,
    audits,
    customerAccepted,
    routedReviewers,
    adminsAvailable,
  };
}
