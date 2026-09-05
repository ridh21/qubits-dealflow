import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
export async function listApprovals() {
  const actor = await requireInternal();
  return prisma.approvalRequest.findMany({
    where: { quotation: quotationScope(actor) },
    include: {
      quotation: { include: { customer: { select: { name: true } } } },
      steps: { orderBy: { index: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
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
