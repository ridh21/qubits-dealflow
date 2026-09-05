import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
import { derivePaymentStatus } from "@/domain/billing/payment-status";
export async function listInvoices() {
  const actor = await requireInternal();
  const rows = await prisma.invoice.findMany({
    where: ["ADMIN", "FINANCE"].includes(actor.role)
      ? {}
      : { order: { quotation: quotationScope(actor) } },
    include: { customer: { select: { name: true } } },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
  return rows.map((i) => ({ ...i, ...derivePaymentStatus(i, new Date()) }));
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
