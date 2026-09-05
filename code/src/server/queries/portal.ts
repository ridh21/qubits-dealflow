import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { requirePortalCustomer, type SessionUser } from "@/server/auth/guards";
import { Forbidden, NotFound } from "@/domain/errors";
import { boundariesFrom } from "@/domain/boundaries/boundaries";
import { effectiveFor } from "@/domain/entitlements/effective";
import { getActivePolicy } from "@/server/services/policy.service";

import {
  PORTAL_MESSAGE_SELECT,
  PORTAL_QUOTE_SELECT,
  PORTAL_ORDER_SELECT,
  PORTAL_INVOICE_SELECT,
  PORTAL_SUBSCRIPTION_SELECT,
  safeEntitlements,
} from "@/server/portal/select";
export * from "@/server/portal/select";

export async function portalActor() {
  const session = await requirePortalCustomer();
  const user = await prisma.user.findFirst({
    where: {
      id: session.id,
      customerId: session.customerId,
      role: "CUSTOMER",
      isActive: true,
      customer: { isActive: true },
    },
    select: { id: true, name: true, email: true, customerId: true },
  });
  if (!user?.customerId)
    throw new Forbidden("Your portal access is no longer active.");
  return {
    ...user,
    customerId: user.customerId,
    role: "CUSTOMER",
    teamId: null,
  } satisfies SessionUser;
}
export function customerScope(actor: SessionUser) {
  if (actor.role !== "CUSTOMER" || !actor.customerId) throw new Forbidden();
  return { customerId: actor.customerId };
}
// A quote must have been shared at least once. Draft revisions show a holding state,
// never unpublished draft lines or prices.
export const sharedQuoteWhere = {
  sentAt: { not: null },
} satisfies Prisma.QuotationWhereInput;
export function quoteIsBeingRevised(status: string) {
  return ["DRAFT", "REVISION_REQUESTED", "REJECTED", "APPROVED"].includes(
    status,
  );
}
export async function getMyQuotation(
  actor: SessionUser,
  id: string,
  db: Tx = prisma,
) {
  const where = { id, ...customerScope(actor), ...sharedQuoteWhere };
  const state = await db.quotation.findFirst({
    where,
    select: { id: true, number: true, status: true },
  });
  if (!state) throw new NotFound();
  if (quoteIsBeingRevised(state.status))
    return { kind: "REVISING" as const, quote: state };
  const quote = await db.quotation.findFirst({
    where: {
      ...where,
      status: {
        notIn: ["DRAFT", "REVISION_REQUESTED", "REJECTED", "APPROVED"],
      },
    },
    select: PORTAL_QUOTE_SELECT,
  });
  if (!quote) throw new NotFound();
  return { kind: "SHARED" as const, quote };
}
export async function listMyQuotations(
  actor: SessionUser,
  filters: { status?: string; page?: string } = {},
  db: Tx = prisma,
) {
  const status = Object.values(QuotationStatus).find(
    (value) => value === filters.status,
  );
  const where = { ...customerScope(actor), ...sharedQuoteWhere, status };
  const total = await db.quotation.count({ where });
  const pages = Math.max(1, Math.ceil(total / 20)),
    page = Math.min(pages, Math.max(1, Math.floor(Number(filters.page) || 1)));
  const rows = await db.quotation.findMany({
    where,
    select: {
      id: true,
      number: true,
      status: true,
      version: true,
      currency: true,
      totalMinor: true,
      validUntil: true,
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "asc" }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return {
    rows: rows.map((row) => ({
      ...row,
      totalMinor: quoteIsBeingRevised(row.status) ? null : row.totalMinor,
    })),
    total,
    page,
    pages,
  };
}
export async function listMyOrders(actor: SessionUser, db: Tx = prisma) {
  return db.order.findMany({
    where: customerScope(actor),
    select: PORTAL_ORDER_SELECT,
    orderBy: { confirmedAt: "desc" },
  });
}
export async function getMyOrder(
  actor: SessionUser,
  id: string,
  db: Tx = prisma,
) {
  const row = await db.order.findFirst({
    where: { id, ...customerScope(actor) },
    select: PORTAL_ORDER_SELECT,
  });
  if (!row) throw new NotFound();
  return row;
}
export async function listMyInvoices(actor: SessionUser, db: Tx = prisma) {
  return db.invoice.findMany({
    where: { ...customerScope(actor), status: { not: "DRAFT" } },
    select: PORTAL_INVOICE_SELECT,
    orderBy: { issuedAt: "desc" },
  });
}
export async function getMyInvoice(
  actor: SessionUser,
  id: string,
  db: Tx = prisma,
) {
  const row = await db.invoice.findFirst({
    where: { id, ...customerScope(actor), status: { not: "DRAFT" } },
    select: PORTAL_INVOICE_SELECT,
  });
  if (!row) throw new NotFound();
  return row;
}
export async function listMySubscriptions(actor: SessionUser, db: Tx = prisma) {
  const rows = await db.subscription.findMany({
    where: customerScope(actor),
    select: PORTAL_SUBSCRIPTION_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ entitlementsSnapshot, ...row }) => ({
    ...row,
    entitlements: safeEntitlements(entitlementsSnapshot),
  }));
}
export async function getMySubscription(
  actor: SessionUser,
  id: string,
  db: Tx = prisma,
) {
  const row = await db.subscription.findFirst({
    where: { id, ...customerScope(actor) },
    select: PORTAL_SUBSCRIPTION_SELECT,
  });
  if (!row) throw new NotFound();
  const [policy, defs, values] = await Promise.all([
    getActivePolicy(db, "PORTAL"),
    db.entitlementDefinition.findMany({
      where: { productId: row.plan.productId },
      select: {
        id: true,
        key: true,
        label: true,
        unit: true,
        per: true,
        valueType: true,
      },
    }),
    row.plan.tierId
      ? db.entitlementValue.findMany({
          where: { tierId: row.plan.tierId },
          select: {
            definitionId: true,
            tierId: true,
            interval: true,
            value: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const pause = row.pauseEffectiveAt ?? row.currentPeriodEnd;
  const boundaries = pause
    ? boundariesFrom(
        row.billingAnchor,
        row.plan.interval,
        new Date(Math.max(pause.getTime(), Date.now()) + 1),
        6,
      )
    : [];
  const { entitlementsSnapshot, ...subscription } = row;
  return {
    subscription,
    entitlements: safeEntitlements(entitlementsSnapshot),
    nextEntitlements: row.plan.tierId
      ? safeEntitlements(
          effectiveFor(defs, values, row.plan.tierId, row.plan.interval),
        )
      : [],
    boundaries,
    allowPauseResume: policy.payload.allowCustomerPauseResume,
  };
}
export async function listMyMessages(actor: SessionUser, db: Tx = prisma) {
  return db.negotiationMessage.findMany({
    where: { quotation: { ...customerScope(actor), ...sharedQuoteWhere } },
    select: {
      ...PORTAL_MESSAGE_SELECT,
      quotation: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
export async function getMyProfile(actor: SessionUser, db: Tx = prisma) {
  const customer = await db.customer.findUnique({
    where: { id: customerScope(actor).customerId },
    select: { name: true, email: true, billingAddress: true },
  });
  if (!customer) throw new NotFound();
  return { name: actor.name, email: actor.email, customer };
}
