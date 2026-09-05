import type { Prisma } from "@prisma/client";

export const FORBIDDEN_PORTAL_KEYS = [
  "costPriceMinor",
  "costMinor",
  "marginMinor",
  "oneTimeMarginMinor",
  "limitBp",
  "excessBp",
  "riskBand",
  "requiredLevel",
  "riskMetrics",
  "policyVersionId",
  "approvals",
  "versions",
  "explanation",
  "internalNote",
  "passwordHash",
] as const;
export const PORTAL_MESSAGE_SELECT = {
  id: true,
  quotationId: true,
  quotationVersion: true,
  lineId: true,
  author: true,
  body: true,
  counterDiscountBp: true,
  proposedQty: true,
  requestedDeliveryDate: true,
  status: true,
  respondedAt: true,
  createdAt: true,
} satisfies Prisma.NegotiationMessageSelect;
export const PORTAL_QUOTE_SELECT = {
  id: true,
  number: true,
  status: true,
  version: true,
  approvedVersion: true,
  currency: true,
  validUntil: true,
  requestedDeliveryDate: true,
  sentAt: true,
  confirmedAt: true,
  subtotalMinor: true,
  discountMinor: true,
  taxMinor: true,
  totalMinor: true,
  orderDiscountBp: true,
  customerNote: true,
  customer: { select: { name: true } },
  owner: { select: { name: true, email: true } },
  lines: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      productName: true,
      variantLabel: true,
      qty: true,
      unitPriceMinor: true,
      discountBp: true,
      effectiveDiscountBp: true,
      netMinor: true,
      taxMinor: true,
      interval: true,
      sortOrder: true,
      product: { select: { type: true } },
      plan: {
        select: {
          name: true,
          interval: true,
          tier: { select: { name: true } },
        },
      },
    },
  },
  messages: { orderBy: { createdAt: "asc" }, select: PORTAL_MESSAGE_SELECT },
  acceptances: { select: { version: true, acceptedAt: true } },
  order: { select: { id: true, number: true } },
} satisfies Prisma.QuotationSelect;
export const PORTAL_ORDER_SELECT = {
  id: true,
  number: true,
  quotationId: true,
  quotationVersion: true,
  status: true,
  fulfillmentStatus: true,
  promisedDeliveryDate: true,
  currency: true,
  confirmedAt: true,
  lines: {
    select: {
      id: true,
      productName: true,
      kind: true,
      qty: true,
      qtyShipped: true,
      qtyInvoiced: true,
      unitPriceMinor: true,
      netMinor: true,
      taxMinor: true,
      interval: true,
      completion: { select: { completedAt: true } },
      subscription: { select: { id: true, status: true } },
    },
  },
  shipments: {
    select: {
      id: true,
      number: true,
      status: true,
      shippedAt: true,
      lines: {
        select: { qty: true, orderLine: { select: { productName: true } } },
      },
    },
  },
  invoices: {
    // Draft invoices are internal-only; the detail route 404s on them, so the
    // order page must not render links to them.
    where: { status: { not: "DRAFT" } },
    select: { id: true, number: true, totalMinor: true, currency: true },
  },
} satisfies Prisma.OrderSelect;
export const PORTAL_INVOICE_SELECT = {
  id: true,
  number: true,
  orderId: true,
  type: true,
  status: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  subtotalMinor: true,
  taxMinor: true,
  totalMinor: true,
  paidMinor: true,
  creditAppliedMinor: true,
  balanceMinor: true,
  paymentStatus: true,
  lines: {
    select: {
      id: true,
      description: true,
      qty: true,
      unitPriceMinor: true,
      amountMinor: true,
      taxMinor: true,
      periodStart: true,
      periodEnd: true,
    },
  },
  payments: {
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      amountMinor: true,
      method: true,
      reference: true,
      paidAt: true,
    },
  },
  creditApplications: {
    select: {
      id: true,
      amountMinor: true,
      appliedAt: true,
      creditNote: { select: { number: true } },
    },
  },
} satisfies Prisma.InvoiceSelect;
export const PORTAL_SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  qty: true,
  unitPriceMinor: true,
  discountBp: true,
  activationDate: true,
  billingAnchor: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  nextBillingDate: true,
  pauseEffectiveAt: true,
  resumeAt: true,
  cancelEffectiveAt: true,
  entitlementsSnapshot: true,
  plan: {
    select: {
      name: true,
      productId: true,
      tierId: true,
      interval: true,
      tier: { select: { name: true } },
    },
  },
  order: { select: { id: true, number: true, currency: true } },
  orderLine: { select: { productName: true } },
  schedule: {
    orderBy: { periodStart: "asc" },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      amountMinor: true,
      status: true,
      invoiceId: true,
    },
  },
  transitions: {
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, effectiveAt: true, createdAt: true },
  },
} satisfies Prisma.SubscriptionSelect;
export type PortalQuote = Prisma.QuotationGetPayload<{
  select: typeof PORTAL_QUOTE_SELECT;
}>;
export type PortalOrder = Prisma.OrderGetPayload<{
  select: typeof PORTAL_ORDER_SELECT;
}>;
export type PortalInvoice = Prisma.InvoiceGetPayload<{
  select: typeof PORTAL_INVOICE_SELECT;
}>;

/** A JWT is not proof that membership is still active. Recheck it at every entry. */
export type PortalEntitlement = {
  label: string;
  value: string;
  unit: string;
  per: string;
};
/** Never serialize arbitrary JSON keys from a stored entitlement snapshot. */
export function safeEntitlements(raw: unknown): PortalEntitlement[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .filter(
      ([key]) =>
        !FORBIDDEN_PORTAL_KEYS.includes(
          key as (typeof FORBIDDEN_PORTAL_KEYS)[number],
        ),
    )
    .map(([key, value]) => {
      const cell: Record<string, unknown> =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : { value };
      return {
        label: typeof cell.label === "string" ? cell.label : key,
        value:
          cell.value === true
            ? "Yes"
            : cell.value === false
              ? "No"
              : typeof cell.value === "string" || typeof cell.value === "number"
                ? String(cell.value)
                : "Not set",
        unit: typeof cell.unit === "string" ? cell.unit : "",
        per: typeof cell.per === "string" ? cell.per.toLowerCase() : "",
      };
    });
}
