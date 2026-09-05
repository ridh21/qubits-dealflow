import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
import { derivePaymentStatus } from "@/domain/billing/payment-status";
import {
  orderByOf,
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";

const InvoiceFilters = z.object({
  type: z.enum(["ONE_TIME", "SERVICE", "RECURRING", "PRORATION"]).optional(),
  payment: z.enum(["unpaid", "partial", "paid", "overdue"]).optional(),
});

export async function listInvoices(sp: SearchParamsRecord) {
  const actor = await requireInternal();
  const p = parseListParams(sp, InvoiceFilters);
  const now = new Date();

  const where: Prisma.InvoiceWhereInput = {
    ...(["ADMIN", "FINANCE"].includes(actor.role)
      ? {}
      : { order: { quotation: quotationScope(actor) } }),
    ...(p.filters.type ? { type: p.filters.type } : {}),
    ...(p.filters.payment === "paid" ? { paymentStatus: "PAID" as const } : {}),
    ...(p.filters.payment === "unpaid" ? { paymentStatus: "UNPAID" as const } : {}),
    ...(p.filters.payment === "partial"
      ? { paymentStatus: "PARTIALLY_PAID" as const }
      : {}),
    // Overdue is settlement plus time, so it stays a two-column predicate.
    ...(p.filters.payment === "overdue"
      ? { balanceMinor: { gt: 0 }, dueAt: { lt: now } }
      : {}),
    ...(p.q
      ? {
          OR: [
            { number: { contains: p.q, mode: "insensitive" } },
            { customer: { name: { contains: p.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orderBy = orderByOf(
    p.sort,
    p.dir,
    ["number", "issuedAt", "dueAt", "totalMinor", "balanceMinor", "paymentStatus"],
    { issuedAt: "desc" },
  );

  const result = await paginate(
    () => prisma.invoice.count({ where }),
    (skip, take) =>
      prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { customer: { select: { name: true } } },
      }),
    p,
  );

  return {
    ...result,
    params: p,
    rows: result.rows.map((i) => ({ ...i, ...derivePaymentStatus(i, now) })),
  };
}
export async function getInvoice(id: string) {
  const actor = await requireInternal();
  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      ...(["ADMIN", "FINANCE"].includes(actor.role)
        ? {}
        : { order: { quotation: quotationScope(actor) } }),
    },
    include: {
      customer: true,
      lines: true,
      payments: { orderBy: { paidAt: "asc" } },
      creditApplications: { include: { creditNote: true } },
      order: { select: { number: true, id: true } },
    },
  });
  if (!invoice) throw new NotFound("Invoice unavailable in your scope.");
  return {
    actor,
    invoice: { ...invoice, ...derivePaymentStatus(invoice, new Date()) },
  };
}
