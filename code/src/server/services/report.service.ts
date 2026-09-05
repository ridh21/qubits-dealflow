import { prisma, type Tx } from "@/server/db";
import { recurringPriceBasis } from "@/domain/proration/prorate";
import type { SessionUser } from "@/server/auth/guards";
import { parseReportFilters, reportPeriod } from "@/lib/zod-schemas/reports";
import {
  reportQuotationWhere,
  reportInvoiceWhere,
} from "@/server/reports/scope";
import {
  avgApprovalHours,
  conversion,
  discountByRep,
  topUpsold,
  arAging,
  mrr,
  bucketByPeriod,
} from "@/domain/reports/kpis";
export async function buildReport(
  actor: SessionUser,
  raw: unknown,
  db: Tx = prisma,
) {
  const filters = parseReportFilters(raw),
    period = reportPeriod(filters),
    scope = reportQuotationWhere(actor, filters),
    invoiceScope = reportInvoiceWhere(actor, filters);
  const [
    quotes,
    invoices,
    approvals,
    subscriptions,
    categories,
    alerts,
    payments,
  ] = await Promise.all([
    db.quotation.findMany({
      where: {
        AND: [scope, { createdAt: { gte: period.from, lt: period.to } }],
      },
      include: {
        customer: { select: { name: true } },
        owner: { select: { name: true } },
        lines: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    db.invoice.findMany({
      where: {
        ...invoiceScope,
        status: "ISSUED",
        issuedAt: { gte: period.from, lt: period.to },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
    }),
    db.approvalRequest.findMany({
      where: {
        quotation: scope,
        createdAt: { gte: period.from, lt: period.to },
      },
      include: {
        quotation: { select: { number: true } },
        steps: { orderBy: { index: "asc" } },
      },
    }),
    db.subscription.findMany({
      where: {
        order: { quotation: scope },
        activationDate: { lt: period.to },
      },
      include: {
        plan: { select: { interval: true } },
        orderLine: {
          select: { qty: true, unitPriceMinor: true, netMinor: true },
        },
        order: { select: { currency: true } },
      },
    }),
    db.category.findMany({ select: { id: true, name: true } }),
    db.dealHealthAlert.count({
      where: {
        status: { not: "RESOLVED" },
        OR: [{ quotation: scope }, { order: { quotation: scope } }],
        flaggedAt: { gte: period.from, lt: period.to },
      },
    }),
    db.payment.findMany({
      where: {
        paidAt: { gte: period.from, lt: period.to },
        invoice: { AND: [invoiceScope, { status: "ISSUED" }] },
      },
      select: { amountMinor: true, invoice: { select: { currency: true } } },
    }),
  ]);
  const steps = approvals.flatMap((request) =>
    request.steps.map((step, index) => ({
      id: step.id,
      quotation: request.quotation.number,
      role: step.role,
      status: step.status,
      startedAt:
        index === 0
          ? request.createdAt
          : (request.steps[index - 1].decidedAt ?? request.createdAt),
      decidedAt: step.decidedAt,
    })),
  );
  const currencies = [
    ...new Set([
      ...quotes.map((q) => q.currency),
      ...invoices.map((i) => i.currency),
      ...payments.map((p) => p.invoice.currency),
      ...subscriptions.map((s) => s.order.currency),
    ]),
  ].sort();
  return {
    filters,
    generatedAt: new Date(),
    actorRole: actor.role,
    summary: {
      ...conversion(quotes),
      approvalHours: avgApprovalHours(steps),
      openAlerts: alerts,
    },
    currencies: currencies.map((currency) => {
      const qs = quotes.filter((q) => q.currency === currency),
        ins = invoices.filter((i) => i.currency === currency);
      return {
        currency,
        revenueMinor: ins.reduce((sum, i) => sum + i.totalMinor, 0),
        discountMinor: qs.reduce((sum, q) => sum + q.discountMinor, 0),
        cashMinor: payments
          .filter((p) => p.invoice.currency === currency)
          .reduce((sum, p) => sum + p.amountMinor, 0),
        aging: arAging(ins, new Date()),
        normalisedMrrMinor: mrr(
          subscriptions
            .filter((s) => s.order.currency === currency)
            .map((s) => ({
              ...s,
              interval: s.plan.interval,
              pricingBasis: recurringPriceBasis(s.orderLine),
            })),
        ),
        revenueTrend: bucketByPeriod(
          ins.map((i) => ({ date: i.issuedAt, value: i.totalMinor })),
          "month",
        ),
      };
    }),
    quotations: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      customer: q.customer.name,
      owner: q.owner.name,
      status: q.status,
      currency: q.currency,
      totalMinor: q.totalMinor,
      discountMinor: q.discountMinor,
      createdAt: q.createdAt,
    })),
    approvals: steps,
    discounts: currencies.flatMap((currency) =>
      discountByRep(
        quotes
          .filter((q) => q.currency === currency)
          .map((q) => ({
            ownerId: q.ownerId,
            grossMinor: q.subtotalMinor,
            discountMinor: q.discountMinor,
          })),
      ).map((row) => ({
        ...row,
        currency,
        owner: quotes.find((q) => q.ownerId === row.ownerId)!.owner.name,
      })),
    ),
    upsell: currencies.flatMap((currency) =>
      topUpsold(
        quotes.filter((q) => q.currency === currency).flatMap((q) => q.lines),
      ).map((row) => ({ ...row, currency })),
    ),
    categories: currencies.flatMap((currency) => {
      const lines = quotes
        .filter((q) => q.currency === currency)
        .flatMap((q) => q.lines);
      return [...new Set(lines.map((l) => l.categoryId))].map((categoryId) => ({
        category:
          categories.find((c) => c.id === categoryId)?.name ??
          "Archived category",
        currency,
        netMinor: lines
          .filter((l) => l.categoryId === categoryId)
          .reduce((sum, l) => sum + l.netMinor, 0),
      }));
    }),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      customer: i.customer.name,
      currency: i.currency,
      type: i.type,
      issuedAt: i.issuedAt,
      dueAt: i.dueAt,
      totalMinor: i.totalMinor,
      paidMinor: i.paidMinor,
      creditAppliedMinor: i.creditAppliedMinor,
      balanceMinor: i.totalMinor - i.paidMinor - i.creditAppliedMinor,
    })),
  };
}
export type ReportData = Awaited<ReturnType<typeof buildReport>>;
