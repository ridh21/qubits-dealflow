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
import { z } from "zod";
import {
  orderByOf,
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";

const PortalOrderFilters = z.object({
  fulfillmentStatus: z
    .enum([
      "UNALLOCATED",
      "RESERVED",
      "PARTIALLY_FULFILLED",
      "BACKORDERED",
      "FULFILLED",
    ])
    .optional(),
});
const PortalInvoiceFilters = z.object({
  payment: z.enum(["outstanding", "paid", "overdue"]).optional(),
});
const PortalSubscriptionFilters = z.object({
  status: z
    .enum(["SCHEDULED", "ACTIVE", "PAUSE_SCHEDULED", "PAUSED", "CANCELLED"])
    .optional(),
});


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
export async function listMyOrders(
  actor: SessionUser,
  sp: SearchParamsRecord = {},
  db: Tx = prisma,
) {
  const p = parseListParams(sp, PortalOrderFilters);
  const where = {
    ...customerScope(actor),
    ...(p.filters.fulfillmentStatus
      ? { fulfillmentStatus: p.filters.fulfillmentStatus }
      : {}),
    ...(p.q ? { number: { contains: p.q, mode: "insensitive" as const } } : {}),
  };
  const result = await paginate(
    () => db.order.count({ where }),
    (skip, take) =>
      db.order.findMany({
        where,
        select: PORTAL_ORDER_SELECT,
        orderBy: orderByOf(p.sort, p.dir, ["number", "confirmedAt"], {
          confirmedAt: "desc",
        }),
        skip,
        take,
      }),
    p,
  );
  return { ...result, params: p };
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
export async function listMyInvoices(
  actor: SessionUser,
  sp: SearchParamsRecord = {},
  db: Tx = prisma,
) {
  const p = parseListParams(sp, PortalInvoiceFilters);
  const where = {
    ...customerScope(actor),
    status: { not: "DRAFT" as const },
    ...(p.filters.payment === "outstanding"
      ? { paymentStatus: { not: "PAID" as const } }
      : {}),
    ...(p.filters.payment === "paid"
      ? { paymentStatus: "PAID" as const }
      : {}),
    ...(p.filters.payment === "overdue"
      ? { balanceMinor: { gt: 0 }, dueAt: { lt: new Date() } }
      : {}),
    ...(p.q ? { number: { contains: p.q, mode: "insensitive" as const } } : {}),
  };
  const result = await paginate(
    () => db.invoice.count({ where }),
    (skip, take) =>
      db.invoice.findMany({
        where,
        select: PORTAL_INVOICE_SELECT,
        orderBy: orderByOf(
          p.sort,
          p.dir,
          ["number", "issuedAt", "dueAt", "balanceMinor"],
          { issuedAt: "desc" },
        ),
        skip,
        take,
      }),
    p,
  );
  return { ...result, params: p };
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
export async function listMySubscriptions(
  actor: SessionUser,
  sp: SearchParamsRecord = {},
  db: Tx = prisma,
) {
  const p = parseListParams(sp, PortalSubscriptionFilters);
  const where = {
    ...customerScope(actor),
    ...(p.filters.status ? { status: p.filters.status } : {}),
  };
  const result = await paginate(
    () => db.subscription.count({ where }),
    (skip, take) =>
      db.subscription.findMany({
        where,
        select: PORTAL_SUBSCRIPTION_SELECT,
        orderBy: orderByOf(p.sort, p.dir, ["createdAt", "status"], {
          createdAt: "desc",
        }),
        skip,
        take,
      }),
    p,
  );
  return {
    ...result,
    params: p,
    rows: result.rows.map(({ entitlementsSnapshot, ...row }) => ({
      ...row,
      entitlements: safeEntitlements(entitlementsSnapshot),
    })),
  };
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
