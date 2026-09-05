import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/server/auth/guards";
import type { ReportFilterValues } from "@/lib/zod-schemas/reports";
import { Forbidden } from "@/domain/errors";
/** Dimensions are intersected with access scope; filters can never widen it. */
export function reportQuotationWhere(
  actor: SessionUser,
  filters: ReportFilterValues,
): Prisma.QuotationWhereInput {
  if (!["ADMIN", "FINANCE", "SALES_MANAGER", "SALES_REP"].includes(actor.role))
    throw new Forbidden();
  const access: Prisma.QuotationWhereInput =
    actor.role === "SALES_REP"
      ? { ownerId: actor.id }
      : actor.role === "SALES_MANAGER"
        ? {
            OR: [
              { ownerId: actor.id },
              ...(actor.teamId ? [{ owner: { teamId: actor.teamId } }] : []),
            ],
          }
        : {};
  const line: Prisma.QuotationLineWhereInput = {
    productId: filters.productId,
    categoryId: filters.categoryId,
    interval: filters.cycle,
  };
  const approval: Prisma.QuotationWhereInput =
    filters.approvalStatus === "NONE_REQUIRED"
      ? {
          requiredLevel: 0,
          status: {
            in: ["APPROVED", "SENT", "UNDER_NEGOTIATION", "CONFIRMED"],
          },
        }
      : filters.approvalStatus === "PENDING"
        ? { status: "PENDING_APPROVAL" }
        : filters.approvalStatus === "APPROVED"
          ? {
              status: {
                in: ["APPROVED", "SENT", "UNDER_NEGOTIATION", "CONFIRMED"],
              },
            }
          : filters.approvalStatus === "REJECTED"
            ? { status: "REJECTED" }
            : {};
  return {
    AND: [
      access,
      {
        ownerId: filters.ownerId,
        owner: filters.teamId ? { teamId: filters.teamId } : undefined,
        customerId: filters.customerId,
        customer: filters.tier ? { tier: filters.tier } : undefined,
        ...(filters.productId || filters.categoryId || filters.cycle
          ? { lines: { some: line } }
          : {}),
      },
      approval,
    ],
  };
}

/** Standalone invoices have no quotation dimensions, but retain customer scope. */
export function reportInvoiceWhere(
  actor: SessionUser,
  filters: ReportFilterValues,
): Prisma.InvoiceWhereInput {
  const quotation = reportQuotationWhere(actor, filters);
  const quotationDimension =
    filters.teamId ||
    filters.ownerId ||
    filters.productId ||
    filters.categoryId ||
    filters.cycle ||
    filters.approvalStatus !== "ALL";
  if (!["ADMIN", "FINANCE"].includes(actor.role) || quotationDimension)
    return { order: { quotation } };
  return {
    OR: [
      { order: { quotation } },
      {
        orderId: null,
        customerId: filters.customerId,
        customer: filters.tier ? { tier: filters.tier } : undefined,
      },
    ],
  };
}
