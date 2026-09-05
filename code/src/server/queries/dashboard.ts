import { Prisma, type QuotationStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireInternal, type SessionUser } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { derivePaymentStatus } from "@/domain/billing/payment-status";
import { activitySentence } from "@/lib/activity-sentence";

export const OPEN_QUOTATION_STATUSES: QuotationStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUESTED",
  "APPROVED",
  "SENT",
  "UNDER_NEGOTIATION",
];

/** AuditLog is polymorphic: authorize the entity, never just the actor who touched it.
 * Unsupported/deleted entities are omitted for non-admins. No audit payloads leave this query.
 */
async function recentActivity(actor: SessionUser) {
  // Prisma model queries honor the URL schema; raw SQL cannot rely on search_path.
  // Only quoted identifiers enter Prisma.raw. Actor and filter values stay bound.
  const schema =
    new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public";
  const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const table = (name: string) =>
    Prisma.raw(`${identifier(schema)}.${identifier(name)}`);
  const allBusiness = actor.role === "ADMIN" || actor.role === "FINANCE";
  const quoteAccess = allBusiness
    ? Prisma.sql`TRUE`
    : actor.role === "SALES_MANAGER" && actor.teamId
      ? Prisma.sql`(q."ownerId" = ${actor.id} OR u."teamId" = ${actor.teamId})`
      : Prisma.sql`q."ownerId" = ${actor.id}`;
  const rows = await prisma.$queryRaw<
    {
      id: string;
      actorType: string;
      isCurrentActor: boolean;
      entityType: string;
      action: string;
      version: number | null;
      createdAt: Date;
    }[]
  >(Prisma.sql`
    WITH visible_quotes AS (
      SELECT q.id FROM ${table("Quotation")} q JOIN ${table("User")} u ON u.id = q."ownerId" WHERE ${quoteAccess}
    ), visible_orders AS (
      SELECT o.id FROM ${table("Order")} o JOIN visible_quotes q ON q.id = o."quotationId"
    ), visible_invoices AS (
      SELECT i.id FROM ${table("Invoice")} i WHERE ${allBusiness} OR i."orderId" IN (SELECT id FROM visible_orders)
    ), visible_subscriptions AS (
      SELECT s.id FROM ${table("Subscription")} s JOIN visible_orders o ON o.id = s."orderId"
    ), visible_entities AS (
      SELECT 'Quotation' AS type, id FROM visible_quotes
      UNION ALL SELECT 'Order', id FROM visible_orders
      UNION ALL SELECT 'Invoice', id FROM visible_invoices
      UNION ALL SELECT 'Subscription', id FROM visible_subscriptions
      UNION ALL SELECT 'QuotationLine', l.id FROM ${table("QuotationLine")} l JOIN visible_quotes q ON q.id = l."quotationId"
      UNION ALL SELECT 'NegotiationMessage', m.id FROM ${table("NegotiationMessage")} m JOIN visible_quotes q ON q.id = m."quotationId"
      UNION ALL SELECT 'ApprovalStep', s.id FROM ${table("ApprovalStep")} s JOIN ${table("ApprovalRequest")} r ON r.id = s."requestId" JOIN visible_quotes q ON q.id = r."quotationId"
      UNION ALL SELECT 'ApprovalRequest', r.id FROM ${table("ApprovalRequest")} r JOIN visible_quotes q ON q.id = r."quotationId"
      UNION ALL SELECT 'Payment', p.id FROM ${table("Payment")} p JOIN visible_invoices i ON i.id = p."invoiceId"
      UNION ALL SELECT 'Shipment', s.id FROM ${table("Shipment")} s JOIN visible_orders o ON o.id = s."orderId"
      UNION ALL SELECT 'FulfillmentPlan', p.id FROM ${table("FulfillmentPlan")} p JOIN visible_orders o ON o.id = p."orderId"
      UNION ALL SELECT 'ServiceCompletion', c.id FROM ${table("ServiceCompletion")} c JOIN visible_orders o ON o.id = c."orderId"
      UNION ALL SELECT 'Backorder', b.id FROM ${table("Backorder")} b JOIN ${table("OrderLine")} l ON l.id = b."orderLineId" JOIN visible_orders o ON o.id = l."orderId"
      UNION ALL SELECT 'DealHealthAlert', a.id FROM ${table("DealHealthAlert")} a WHERE a."quotationId" IN (SELECT id FROM visible_quotes) OR a."orderId" IN (SELECT id FROM visible_orders)
      UNION ALL SELECT 'CreditNote', c.id FROM ${table("CreditNote")} c WHERE ${allBusiness} OR c."subscriptionId" IN (SELECT id FROM visible_subscriptions) OR c."sourceInvoiceId" IN (SELECT id FROM visible_invoices)
    )
    SELECT a.id, a."actorType", COALESCE(a."actorId" = ${actor.id}, FALSE) AS "isCurrentActor",
      a."entityType", a.action, a.version, a."createdAt"
    FROM ${table("AuditLog")} a
    WHERE ${actor.role === "ADMIN"} OR EXISTS (
      SELECT 1 FROM visible_entities e WHERE e.type = a."entityType" AND e.id = a."entityId"
    )
    ORDER BY a."createdAt" DESC, a.id DESC LIMIT 12
  `);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    sentence: activitySentence(row),
  }));
}

export async function getDashboard() {
  const actor = await requireInternal();
  const scope = quotationScope(actor);
  const isFinance = actor.role === "FINANCE" || actor.role === "ADMIN";
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const invoiceScope: Prisma.InvoiceWhereInput = isFinance
    ? {}
    : { order: { quotation: scope } };
  const [
    pipeline,
    requests,
    atRisk,
    invoices,
    revenue,
    pendingUsers,
    activity,
  ] = await Promise.all([
    prisma.quotation.groupBy({
      by: ["status", "currency"],
      where: { AND: [scope, { status: { in: OPEN_QUOTATION_STATUSES } }] },
      _count: { _all: true },
      _sum: { totalMinor: true },
      orderBy: [{ status: "asc" }, { currency: "asc" }],
    }),
    prisma.approvalRequest.findMany({
      where: {
        status: "PENDING",
        quotation: { AND: [scope, { status: "PENDING_APPROVAL" }] },
      },
      select: {
        quotationVersion: true,
        currentStepIndex: true,
        quotation: { select: { version: true, ownerId: true } },
        steps: {
          where: { status: "PENDING" },
          select: { index: true, role: true },
        },
      },
    }),
    // Count deals once, even if both the quotation and its order have multiple alerts.
    prisma.quotation.count({
      where: {
        AND: [
          scope,
          {
            OR: [
              { alerts: { some: { status: { not: "RESOLVED" } } } },
              { order: { alerts: { some: { status: { not: "RESOLVED" } } } } },
            ],
          },
        ],
      },
    }),
    prisma.invoice.findMany({
      where: { ...invoiceScope, status: "ISSUED" },
      select: {
        currency: true,
        totalMinor: true,
        paidMinor: true,
        creditAppliedMinor: true,
        dueAt: true,
      },
    }),
    isFinance
      ? prisma.invoice.groupBy({
          by: ["currency"],
          where: {
            ...invoiceScope,
            status: "ISSUED",
            issuedAt: { gte: monthStart, lte: now },
          },
          _sum: { totalMinor: true },
          orderBy: { currency: "asc" },
        })
      : Promise.resolve(null),
    actor.role === "ADMIN"
      ? prisma.user.count({ where: { role: "PENDING" } })
      : Promise.resolve(null),
    recentActivity(actor),
  ]);
  const pendingApprovals = requests.filter((request) => {
    if (request.quotationVersion !== request.quotation.version) return false;
    return request.steps.some(
      (step) =>
        step.index === request.currentStepIndex &&
        (actor.role === "SALES_REP" ||
          (request.quotation.ownerId !== actor.id &&
            (actor.role === "ADMIN" || step.role === actor.role))),
    );
  }).length;
  const balances = new Map<
    string,
    {
      currency: string;
      unpaidMinor: number;
      overdueMinor: number;
      unpaidCount: number;
      overdueCount: number;
    }
  >();
  for (const invoice of invoices) {
    const payment = derivePaymentStatus(invoice, now);
    if (payment.balanceMinor === 0) continue;
    const row = balances.get(invoice.currency) ?? {
      currency: invoice.currency,
      unpaidMinor: 0,
      overdueMinor: 0,
      unpaidCount: 0,
      overdueCount: 0,
    };
    row.unpaidMinor += payment.balanceMinor;
    row.unpaidCount++;
    if (payment.isOverdue) {
      row.overdueMinor += payment.balanceMinor;
      row.overdueCount++;
    }
    balances.set(invoice.currency, row);
  }
  const invoiceBalances = [...balances.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
  return {
    actor,
    now,
    monthStart,
    pendingApprovals,
    pendingUsers,
    atRisk,
    activity,
    openQuotations: pipeline.reduce((sum, row) => sum + row._count._all, 0),
    pipeline:
      actor.role === "SALES_REP"
        ? pipeline.map((row) => ({
            status: row.status,
            currency: row.currency,
            count: row._count._all,
            totalMinor: row._sum.totalMinor ?? 0,
          }))
        : null,
    invoiceBalances,
    unpaidCount: invoiceBalances.reduce((sum, row) => sum + row.unpaidCount, 0),
    overdueCount: invoiceBalances.reduce(
      (sum, row) => sum + row.overdueCount,
      0,
    ),
    revenue:
      revenue?.map((row) => ({
        currency: row.currency,
        totalMinor: row._sum.totalMinor ?? 0,
      })) ?? null,
  };
}
