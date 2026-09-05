import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
import {
  orderByOf,
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";

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
    quotation: {
      ...quotationScope(actor),
      ...(p.q
        ? {
            OR: [
              { number: { contains: p.q, mode: "insensitive" } },
              { customer: { name: { contains: p.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
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
          quotation: { include: { customer: { select: { name: true } } } },
          steps: { orderBy: { index: "asc" } },
        },
      }),
    p,
  );
  return { ...result, params: p };
}
export async function getApproval(id: string) {
  const actor = await requireInternal();
  const request = await prisma.approvalRequest.findFirst({
    where: { id, quotation: quotationScope(actor) },
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
  return { actor, request, policy, audits };
}
