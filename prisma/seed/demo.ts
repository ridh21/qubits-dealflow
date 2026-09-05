/**
 * Full demo seed: every model, every status, every edge case the app can
 * represent. All rows use deterministic "sd_" ids so the seed is repeatable —
 * it purges its own rows and recreates them without touching admin data.
 *
 * Conventions mirror the runtime services exactly:
 *  - money is INR minor units (paise), percentages are basis points
 *  - line/totals math comes from the real domain pricing + risk engines
 *  - document numbers use the 5-digit padded sequence format in a reserved
 *    09501+ block; NumberSequence rows are bumped past the block
 *  - invoice/credit/transition idempotency keys follow the service formats
 *  - billing boundaries are derived from each subscription's activation
 *    anchor, so schedules, invoices and credits line up period by period
 */
import {
  Prisma,
  type RecurringInterval,
  type QuotationStatus,
  type RiskBand,
} from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import type { DbClient } from "@/server/db";
import { pctOf, applyDiscount } from "../../src/domain/money/money";
import { priceQuotation } from "../../src/domain/pricing/price-quotation";
import type { PricedLine } from "../../src/domain/pricing/types";
import { simulateDiscountRisk, type SimResult } from "../../src/domain/risk/evaluate";
import { termsHash } from "../../src/domain/quotation/terms-hash";
import { periodEnd } from "../../src/domain/proration/period";
import { periodAmount, prorate } from "../../src/domain/proration/prorate";
import { effectiveFor } from "../../src/domain/entitlements/effective";
import type { PolicyPayload } from "../../src/domain/policy/schemas";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.now();
const ago = (days: number) => new Date(NOW - days * DAY);
const ahead = (days: number) => new Date(NOW + days * DAY);
const hoursAhead = (hours: number) => new Date(NOW + hours * HOUR);
const uuid = () => randomUUID();
const hex64 = () => randomBytes(32).toString("hex");
/** Prisma Json columns reject `undefined`; this normalises dates/nested nulls. */
const j = (x: unknown) => JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
const pad = (n: number) => String(n).padStart(5, "0");
const partOf = (total: number, part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((total * part) / whole);

type DiscountRiskPolicy = PolicyPayload<"DISCOUNT_RISK">;
type FulfillmentPolicy = PolicyPayload<"FULFILLMENT">;

// ─────────────────────────────────────────────────────────────── purge ──

async function purgeDemoData(prisma: DbClient) {
  // Children first; every demo row carries an "sd_" id so this is exact.
  const tables = [
    prisma.creditApplication,
    prisma.payment,
    prisma.invoiceLine,
    prisma.invoice,
    prisma.billingScheduleItem,
    prisma.subscriptionTransition,
    prisma.creditNote,
    prisma.subscription,
    prisma.serviceCompletion,
    prisma.shipmentLine,
    prisma.shipment,
    prisma.backorder,
    prisma.allocation,
    prisma.fulfillmentPlan,
    prisma.orderLine,
    prisma.order,
    prisma.negotiationMessage,
    prisma.quoteAcceptance,
    prisma.approvalStep,
    prisma.approvalRequest,
    prisma.quotationVersion,
    prisma.dealHealthAlert,
    prisma.quotationLine,
    prisma.quotation,
    prisma.stockMovement,
    prisma.replenishmentPlan,
    prisma.upsellRule,
    prisma.entitlementValue,
    prisma.entitlementDefinition,
    prisma.planChangeNotice,
    prisma.planTier,
    prisma.subscriptionPlan,
    prisma.notification,
    prisma.emailMessage,
    prisma.auditLog,
    prisma.policyVersion,
    prisma.team,
  ] as unknown as {
    deleteMany(args: { where: { id: { startsWith: string } } }): Prisma.PrismaPromise<number>;
  }[];
  // Rows created through a nested `create` get a cuid, not an "sd_" id, so an
  // id-prefix sweep silently leaves them behind and the next reseed trips over
  // their foreign keys. They are scoped by their demo parent instead; their own
  // children (InvoiceLine, ShipmentLine, Allocation) cascade.
  const demo = { startsWith: "sd_" };
  await prisma.creditApplication.deleteMany({
    where: { invoice: { order: { id: demo } } },
  });
  await prisma.payment.deleteMany({ where: { invoice: { order: { id: demo } } } });
  await prisma.invoice.deleteMany({ where: { order: { id: demo } } });
  await prisma.shipment.deleteMany({ where: { order: { id: demo } } });
  await prisma.serviceCompletion.deleteMany({
    where: { orderLine: { order: { id: demo } } },
  });
  await prisma.fulfillmentPlan.deleteMany({ where: { order: { id: demo } } });
  await prisma.backorder.deleteMany({
    where: { orderLine: { order: { id: demo } } },
  });

  for (const table of tables) {
    await table.deleteMany({ where: { id: { startsWith: "sd_" } } });
  }
  // VerificationToken has a composite key and no id — sweep demo-domain tokens.
  await prisma.verificationToken.deleteMany({
    where: { identifier: { endsWith: "yopmail.com" } },
  });
}

/** Runtime numbering continues after the reserved 09xxx demo block. */
async function bumpSequences(prisma: DbClient) {
  for (const key of ["Q", "ORD", "INV", "CN", "SHP"] as const) {
    const row = await prisma.numberSequence.findUnique({ where: { key } });
    const next = Math.max(row?.next ?? 0, 9700);
    await prisma.numberSequence.upsert({
      where: { key },
      update: { next },
      create: { key, next },
    });
  }
}

// ─────────────────────────────────────────────────────── quote builder ──

interface LineSpec {
  key: string;
  sku: string;
  qty: number;
  discountBp?: number;
  interval?: RecurringInterval | null;
  tier?: string;
  variants?: [string, string][];
  addedFromUpsell?: boolean;
}

interface RevisionSpec {
  reason: string;
  daysAgo: number;
  lines: LineSpec[];
  orderDiscountBp?: number;
}

interface QuoteSpec {
  key: string;
  number: number;
  customer: string;
  owner: "rahul" | "sneha";
  status: QuotationStatus;
  revisions: RevisionSpec[];
  validUntilDays?: number | null;
  requestedDeliveryDays?: number | null;
  customerNote?: string | null;
  sentDaysAgo?: number | null;
  confirmedDaysAgo?: number | null;
  lastActivityDaysAgo?: number | null;
  portalToken?: boolean;
  approvedVersion?: number | null;
}

interface Catalogue {
  policy: DiscountRiskPolicy;
  policyVersionId: string;
  fulfillment: FulfillmentPolicy;
  users: Record<string, string>;
  customers: Record<
    string,
    { id: string; tier: "BRONZE" | "SILVER" | "GOLD"; priceListId: string | null; currency: string }
  >;
  products: Record<
    string,
    { id: string; name: string; categoryId: string; basePriceMinor: number; costPriceMinor: number; taxBp: number; status: string }
  >;
  lists: Record<string, { rule: string; percentOffBp: number; items: Map<string, number> }>;
  plans: Map<string, { id: string; priceMinor: number; name: string; tierId: string | null; interval: RecurringInterval }>;
  variants: Map<string, Map<string, { id: string; extra: number }>>;
  warehouses: Record<string, string>;
}

function unitPriceFor(
  cat: Catalogue,
  sku: string,
  list: { rule: string; percentOffBp: number; items: Map<string, number> } | undefined,
  extras: number,
): number {
  const product = cat.products[sku];
  if (!list) return product.basePriceMinor + extras;
  if (list.rule === "PERCENT_OFF_BASE")
    return applyDiscount(product.basePriceMinor, list.percentOffBp) + extras;
  const item = list.items.get(product.id);
  if (item !== undefined) return item + extras;
  return product.basePriceMinor + extras;
}

interface PricedRevision {
  priced: ReturnType<typeof priceQuotation>;
  sim: SimResult | null;
  lines: PricedLine[];
  orderDiscountBp: number;
  planByLine: Map<string, string>;
  variantByLine: Map<string, { ids: string[]; label: string | null }>;
  upsellByLine: Map<string, boolean>;
}

interface BuiltQuote {
  spec: QuoteSpec;
  id: string;
  number: string;
  customerId: string;
  ownerId: string;
  version: number;
  final: PricedRevision;
  revisions: PricedRevision[];
  lineIds: Map<string, string>;
  requiredLevel: number;
  riskBand: RiskBand;
  validUntil: Date | null;
  requestedDeliveryDate: Date | null;
}

function buildQuote(cat: Catalogue, spec: QuoteSpec): BuiltQuote {
  const customer = cat.customers[spec.customer];
  const ownerId = cat.users[spec.owner];
  const quoteId = `sd_${spec.key}`;
  const list = customer.priceListId ? cat.lists[customer.priceListId] : undefined;
  const revisions: PricedRevision[] = [];

  for (const rev of spec.revisions) {
    const planByLine = new Map<string, string>();
    const variantByLine = new Map<string, { ids: string[]; label: string | null }>();
    const upsellByLine = new Map<string, boolean>();
    const lines = rev.lines.map((line, index) => {
      const product = cat.products[line.sku];
      let extras = 0;
      if (line.variants?.length) {
        const ids: string[] = [];
        const labels: string[] = [];
        for (const [attr, value] of line.variants) {
          const v = cat.variants.get(`${line.sku}:${attr}`)?.get(value);
          if (!v) throw new Error(`Unknown variant ${line.sku}:${attr}:${value}`);
          extras += v.extra;
          ids.push(v.id);
          labels.push(`${attr}: ${value}`);
        }
        variantByLine.set(line.key, { ids, label: labels.join(" · ") });
      }
      let unitPriceMinor: number;
      let planId: string | null = null;
      if (line.tier) {
        const plan = cat.plans.get(`${line.sku}:${line.tier}:${line.interval}`);
        if (!plan) throw new Error(`No plan for ${line.sku} ${line.tier} ${line.interval}`);
        planId = plan.id;
        planByLine.set(line.key, plan.id);
        unitPriceMinor = plan.priceMinor;
      } else {
        unitPriceMinor = unitPriceFor(cat, line.sku, list, extras);
      }
      upsellByLine.set(line.key, line.addedFromUpsell ?? false);
      return {
        id: `sd_${spec.key}_ln_${line.key}`,
        productId: product.id,
        categoryId: product.categoryId,
        qty: line.qty,
        unitPriceMinor,
        costPriceMinor: product.costPriceMinor,
        taxBp: product.taxBp,
        discountBp: line.discountBp ?? 0,
        interval: line.interval ?? null,
        sortOrder: index,
      };
    });
    const orderDiscountBp = rev.orderDiscountBp ?? 0;
    const priced = priceQuotation({
      lines,
      orderDiscountBp,
      tierCeilingBp: cat.policy.tierCeilingsBp[customer.tier],
      categoryCeilingsBp: cat.policy.categoryCeilingsBp,
    });
    let sim: SimResult | null = null;
    if (spec.status !== "DRAFT" && lines.length > 0) {
      sim = simulateDiscountRisk(cat.policy, {
        tier: customer.tier,
        orderDiscountBp,
        lines: priced.lines.map((l) => ({
          id: l.id,
          categoryId: l.categoryId,
          baseMinor: l.baseMinor,
          discountBp: l.discountBp,
          cycle: l.interval ?? "ONE_TIME",
        })),
      });
    }
    revisions.push({
      priced,
      sim,
      lines: priced.lines,
      orderDiscountBp,
      planByLine,
      variantByLine,
      upsellByLine,
    });
  }

  const final = revisions[revisions.length - 1];
  const requiredLevel = final.sim?.requiredLevel ?? 0;
  const riskBand: RiskBand = requiredLevel === 0 ? "LOW" : requiredLevel === 1 ? "MEDIUM" : "HIGH";

  return {
    spec,
    id: quoteId,
    number: `Q-${pad(spec.number)}`,
    customerId: customer.id,
    ownerId,
    version: revisions.length,
    final,
    revisions,
    lineIds: new Map(final.lines.map((l) => [lineKeyOf(l.id), l.id])),
    requiredLevel,
    riskBand,
    validUntil: spec.validUntilDays == null ? null : ahead(spec.validUntilDays),
    requestedDeliveryDate:
      spec.requestedDeliveryDays == null ? null : ahead(spec.requestedDeliveryDays),
  };
}

async function persistQuote(prisma: DbClient, cat: Catalogue, q: BuiltQuote) {
  const spec = q.spec;
  const last = q.final;
  const header = last.priced;
  const sentAt = spec.sentDaysAgo == null ? null : ago(spec.sentDaysAgo);
  const confirmedAt = spec.confirmedDaysAgo == null ? null : ago(spec.confirmedDaysAgo);

  await prisma.quotation.create({
    data: {
      id: q.id,
      number: q.number,
      customerId: q.customerId,
      ownerId: q.ownerId,
      status: spec.status,
      version: q.version,
      currency: "INR",
      priceListId: cat.customers[spec.customer].priceListId,
      orderDiscountBp: last.orderDiscountBp,
      subtotalMinor: header.subtotalMinor,
      discountMinor: header.discountMinor,
      taxMinor: header.taxMinor,
      totalMinor: header.totalMinor,
      oneTimeNetMinor: header.oneTime.netMinor,
      oneTimeMarginMinor: header.oneTime.marginMinor,
      recurringByCycle: j(header.recurringByCycle),
      riskBand: q.riskBand,
      requiredLevel: q.requiredLevel,
      riskMetrics: last.sim ? j(last.sim) : Prisma.JsonNull,
      policyVersionId: cat.policyVersionId,
      approvedVersion: spec.approvedVersion ?? null,
      portalToken: spec.portalToken ? hex64() : null,
      validUntil: q.validUntil,
      requestedDeliveryDate: q.requestedDeliveryDate,
      customerNote: spec.customerNote ?? null,
      lastActivityAt:
        spec.lastActivityDaysAgo == null
          ? ago(spec.revisions[spec.revisions.length - 1].daysAgo)
          : ago(spec.lastActivityDaysAgo),
      sentAt,
      confirmedAt,
      lines: {
        create: last.lines.map((l) => lineCreateData(cat, q, l)),
      },
    },
  });

  for (const [index, rev] of q.revisions.entries()) {
    const revHeader = rev.priced;
    const createdAt = ago(spec.revisions[index].daysAgo);
    const snapshot = {
      id: q.id,
      number: q.number,
      customerId: q.customerId,
      ownerId: q.ownerId,
      status: spec.status,
      version: index + 1,
      currency: "INR",
      priceListId: cat.customers[spec.customer].priceListId,
      orderDiscountBp: rev.orderDiscountBp,
      subtotalMinor: revHeader.subtotalMinor,
      discountMinor: revHeader.discountMinor,
      taxMinor: revHeader.taxMinor,
      totalMinor: revHeader.totalMinor,
      oneTimeNetMinor: revHeader.oneTime.netMinor,
      oneTimeMarginMinor: revHeader.oneTime.marginMinor,
      recurringByCycle: revHeader.recurringByCycle,
      riskBand:
        rev.sim
          ? rev.sim.requiredLevel === 0
            ? "LOW"
            : rev.sim.requiredLevel === 1
              ? "MEDIUM"
              : "HIGH"
          : "LOW",
      requiredLevel: rev.sim?.requiredLevel ?? 0,
      validUntil: q.validUntil?.toISOString() ?? null,
      requestedDeliveryDate: q.requestedDeliveryDate?.toISOString() ?? null,
      customerNote: spec.customerNote ?? null,
      createdAt: createdAt.toISOString(),
      lines: rev.lines.map((l) => ({
        ...lineCreateData(cat, q, l, rev),
        createdAt: createdAt.toISOString(),
      })),
    };
    await prisma.quotationVersion.create({
      data: {
        id: `sd_${spec.key}_v${index + 1}`,
        quotationId: q.id,
        version: index + 1,
        snapshot: j(snapshot),
        termsHash: termsHash({
          customerId: q.customerId,
          orderDiscountBp: rev.orderDiscountBp,
          validUntil: q.validUntil,
          requestedDeliveryDate: q.requestedDeliveryDate,
          customerNote: spec.customerNote ?? null,
          lines: rev.lines.map((l) => ({
            productId: l.productId,
            variantValueIds: [...(rev.variantByLine.get(lineKeyOf(l.id))?.ids ?? [])].sort(),
            planId: rev.planByLine.get(lineKeyOf(l.id)) ?? null,
            qty: l.qty,
            discountBp: l.discountBp ?? 0,
            unitPriceMinor: l.unitPriceMinor,
            taxBp: l.taxBp,
            interval: l.interval ?? null,
          })),
        }),
        policyVersionId: cat.policyVersionId,
        riskMetrics: rev.sim ? j(rev.sim) : Prisma.JsonNull,
        requiredLevel: rev.sim?.requiredLevel ?? 0,
        createdById: q.ownerId,
        createdByType: "USER",
        reason: spec.revisions[index].reason,
        createdAt,
      },
    });
  }
}

function lineCreateData(
  cat: Catalogue,
  q: BuiltQuote,
  l: PricedLine,
  rev?: PricedRevision,
) {
  const r = rev ?? q.final;
  const sku = skuOf(cat, l.productId);
  return {
    id: l.id,
    productId: l.productId,
    productName: cat.products[sku].name,
    categoryId: l.categoryId,
    variantValueIds: r.variantByLine.get(lineKeyOf(l.id))?.ids ?? [],
    variantLabel: r.variantByLine.get(lineKeyOf(l.id))?.label ?? null,
    planId: r.planByLine.get(lineKeyOf(l.id)) ?? null,
    interval: l.interval,
    qty: l.qty,
    unitPriceMinor: l.unitPriceMinor,
    costPriceMinor: l.costPriceMinor,
    taxBp: l.taxBp,
    discountBp: l.discountBp,
    baseMinor: l.baseMinor,
    lineDiscountMinor: l.lineDiscountMinor,
    orderDiscountAllocMinor: l.orderDiscountAllocMinor,
    netMinor: l.netMinor,
    taxMinor: l.taxMinor,
    effectiveDiscountBp: l.effectiveDiscountBp,
    limitBp: l.limitBp,
    excessBp: l.excessBp,
    marginMinor: l.marginMinor,
    sortOrder: l.sortOrder,
    addedFromUpsell: r.upsellByLine.get(lineKeyOf(l.id)) ?? false,
  };
}

function skuOf(cat: Catalogue, productId: string): string {
  for (const [sku, p] of Object.entries(cat.products)) if (p.id === productId) return sku;
  throw new Error(`Unknown product ${productId}`);
}
function lineKeyOf(lineId: string): string {
  return lineId.replace(/^sd_[a-z0-9]+_ln_/, "");
}

// ────────────────────────────────────────────────────────── approvals ──

type StepSpec = {
  role: "SALES_MANAGER" | "FINANCE";
  status: "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "SUPERSEDED";
  assignee?: string;
  decidedBy?: string;
  decidedDaysAgo?: number;
  note?: string;
  dueInHours?: number | null;
};

async function addApproval(
  prisma: DbClient,
  cat: Catalogue,
  q: BuiltQuote,
  opts: {
    id: string;
    version: number;
    requiredLevel: number;
    status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "SUPERSEDED";
    currentStepIndex: number;
    steps: StepSpec[];
    decidedDaysAgo?: number | null;
  },
) {
  const sim = q.final.sim;
  if (!sim) throw new Error(`Approval for ${q.number} needs a submitted revision`);
  const riskBand: RiskBand =
    opts.requiredLevel === 0 ? "LOW" : opts.requiredLevel === 1 ? "MEDIUM" : "HIGH";
  await prisma.approvalRequest.create({
    data: {
      id: opts.id,
      quotationId: q.id,
      quotationVersion: opts.version,
      policyVersionId: cat.policyVersionId,
      requiredLevel: opts.requiredLevel,
      riskBand,
      metrics: j(sim.buckets),
      explanation: j(sim.explanations),
      status: opts.status,
      currentStepIndex: opts.currentStepIndex,
      createdAt: ago((opts.decidedDaysAgo ?? 2) + 1),
      decidedAt: opts.decidedDaysAgo == null ? null : ago(opts.decidedDaysAgo),
      steps: {
        create: opts.steps.map((step, index) => ({
          id: `${opts.id}_st${index}`,
          index,
          role: step.role,
          assigneeId: step.assignee ? cat.users[step.assignee] : null,
          status: step.status,
          decidedById: step.decidedBy ? cat.users[step.decidedBy] : null,
          decidedAt: step.decidedDaysAgo == null ? null : ago(step.decidedDaysAgo),
          note: step.note ?? null,
          dueAt: step.status === "WAITING" || step.dueInHours == null ? null : hoursAhead(step.dueInHours),
        })),
      },
    },
  });
}

// ───────────────────────────────────────────────────────────── orders ──

interface OrderSpec {
  key: string;
  number: number;
  quoteKey: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  fulfillmentStatus: "UNALLOCATED" | "RESERVED" | "PARTIALLY_FULFILLED" | "BACKORDERED" | "FULFILLED";
  plan?: {
    status: "SUGGESTED" | "ACCEPTED" | "OVERRIDDEN";
    method: "EXHAUSTIVE" | "GREEDY" | "MANUAL";
    allocations: { lineKey: string; warehouse: string; qty: number; qtyShipped?: number }[];
    backorders?: {
      lineKey: string;
      qty: number;
      status: "OPEN" | "CONSOLIDATION_SUGGESTED" | "ALLOCATED";
      suggested?: { warehouse: string; qty: number };
    }[];
    decidedBy?: string;
    decidedDaysAgo?: number;
  };
  shipments?: {
    key: string;
    number: number;
    warehouse: string;
    status: "PLANNED" | "SHIPPED";
    lines: { lineKey: string; qty: number }[];
    shippedDaysAgo?: number;
    shippedBy?: string;
  }[];
  completions?: { lineKey: string; daysAgo: number; note?: string | null; recordedBy: string }[];
}

async function createOrder(
  prisma: DbClient,
  cat: Catalogue,
  orders: Map<string, BuiltQuote>,
  spec: OrderSpec,
) {
  const q = orders.get(spec.quoteKey)!;
  const orderId = `sd_${spec.key}`;
  await prisma.order.create({
    data: {
      id: orderId,
      number: `ORD-${pad(spec.number)}`,
      quotationId: q.id,
      quotationVersion: q.version,
      customerId: q.customerId,
      status: spec.status,
      fulfillmentStatus: spec.fulfillmentStatus,
      promisedDeliveryDate: q.requestedDeliveryDate,
      currency: "INR",
      confirmedAt: q.spec.confirmedDaysAgo ? ago(q.spec.confirmedDaysAgo) : new Date(NOW),
      lines: {
        create: q.final.lines.map((l) => ({
          id: `sd_${spec.key}_ol_${lineKeyOf(l.id)}`,
          productId: l.productId,
          productName: cat.products[skuOf(cat, l.productId)].name,
          quotationLineId: l.id,
          kind: productKind(cat, l.productId),
          qty: l.qty,
          qtyShipped: (spec.shipments ?? [])
            .filter((s) => s.status === "SHIPPED")
            .flatMap((s) => s.lines)
            .filter((s) => s.lineKey === lineKeyOf(l.id))
            .reduce((sum, s) => sum + s.qty, 0),
          unitPriceMinor: l.unitPriceMinor,
          netMinor: l.netMinor,
          taxMinor: l.taxMinor,
          taxBp: l.taxBp,
          costPriceMinor: l.costPriceMinor,
          planId: q.final.planByLine.get(lineKeyOf(l.id)) ?? null,
          interval: l.interval,
          discountBp: l.effectiveDiscountBp,
        })),
      },
    },
  });

  if (spec.plan) {
    const plan = spec.plan;
    const penalty = cat.fulfillment.shipmentCountPenaltyMinor;
    const warehousesUsed = [...new Set(plan.allocations.map((a) => a.warehouse))];
    const shipmentsCount = warehousesUsed.length;
    let estimatedCost = 0;
    for (const w of warehousesUsed) {
      const wh = await prisma.warehouse.findUnique({ where: { id: cat.warehouses[w] } });
      if (!wh) throw new Error(`Unknown warehouse ${w}`);
      const qty = plan.allocations.filter((a) => a.warehouse === w).reduce((s, a) => s + a.qty, 0);
      estimatedCost += wh.fixedShipmentCostMinor + qty * wh.shippingCostWeightMinor;
    }
    const productOf = (lineKey: string) =>
      q.final.lines.find((l) => lineKeyOf(l.id) === lineKey)!.productId;
    const rationale: Record<string, unknown> =
      plan.method === "MANUAL"
        ? {
            method: "MANUAL",
            rationale: ["Manually split by the fulfilment lead."],
            warehousesUsed: warehousesUsed.map((w) => cat.warehouses[w]),
            allocations: plan.allocations.map((a) => ({
              orderLineId: `sd_${spec.key}_ol_${a.lineKey}`,
              warehouseId: cat.warehouses[a.warehouse],
              qty: a.qty,
            })),
          }
        : {
            allocations: plan.allocations.map((a) => ({
              orderLineId: `sd_${spec.key}_ol_${a.lineKey}`,
              productId: productOf(a.lineKey),
              warehouseId: cat.warehouses[a.warehouse],
              qty: a.qty,
            })),
            backorders: (plan.backorders ?? []).map((b) => ({
              orderLineId: `sd_${spec.key}_ol_${b.lineKey}`,
              productId: productOf(b.lineKey),
              qty: b.qty,
            })),
            shipments: shipmentsCount,
            estimatedCostMinor: estimatedCost,
            objectiveMinor: estimatedCost + penalty * shipmentsCount,
            warehousesUsed: warehousesUsed.map((w) => cat.warehouses[w]),
            rationale: [
              `${plan.allocations.reduce((s, a) => s + a.qty, 0)} units fulfilled across ${shipmentsCount} shipments.`,
              ...(plan.backorders?.length
                ? [`${plan.backorders.reduce((s, b) => s + b.qty, 0)} units remain on backorder.`]
                : []),
            ],
            method: plan.method,
          };
    await prisma.fulfillmentPlan.create({
      data: {
        id: `sd_${spec.key}_plan`,
        orderId,
        status: plan.status,
        estimatedShipments: shipmentsCount,
        estimatedCostMinor: estimatedCost,
        rationale: j(rationale),
        policyVersionId: cat.policyVersionId,
        createdAt: ago((plan.decidedDaysAgo ?? 5) + 2),
        decidedAt: plan.decidedDaysAgo == null ? null : ago(plan.decidedDaysAgo),
        decidedById: plan.decidedBy ? cat.users[plan.decidedBy] : null,
        allocations: {
          create: plan.allocations.map((a) => ({
            id: `sd_${spec.key}_al_${a.lineKey}_${a.warehouse}`,
            orderLineId: `sd_${spec.key}_ol_${a.lineKey}`,
            warehouseId: cat.warehouses[a.warehouse],
            qty: a.qty,
            qtyShipped: a.qtyShipped ?? 0,
            reserved: plan.status !== "SUGGESTED",
          })),
        },
      },
    });
    for (const b of plan.backorders ?? []) {
      await prisma.backorder.create({
        data: {
          id: `sd_${spec.key}_bo_${b.lineKey}_${b.status}`,
          orderLineId: `sd_${spec.key}_ol_${b.lineKey}`,
          qty: b.qty,
          status: b.status,
          suggestedWarehouseId: b.suggested ? cat.warehouses[b.suggested.warehouse] : null,
          suggestedQty: b.suggested?.qty ?? null,
          createdAt: ago((plan.decidedDaysAgo ?? 5) + 1),
        },
      });
    }
  }

  for (const s of spec.shipments ?? []) {
    await prisma.shipment.create({
      data: {
        id: `sd_${spec.key}_shp_${s.key}`,
        number: `SHP-${pad(s.number)}`,
        orderId,
        warehouseId: cat.warehouses[s.warehouse],
        status: s.status,
        shippedAt: s.shippedDaysAgo == null ? null : ago(s.shippedDaysAgo),
        shippedById: s.shippedBy ? cat.users[s.shippedBy] : null,
        lines: {
          create: s.lines.map((l) => ({
            id: `sd_${spec.key}_shpl_${s.key}_${l.lineKey}`,
            orderLineId: `sd_${spec.key}_ol_${l.lineKey}`,
            qty: l.qty,
          })),
        },
      },
    });
  }

  for (const c of spec.completions ?? []) {
    await prisma.serviceCompletion.create({
      data: {
        id: `sd_${spec.key}_sc_${c.lineKey}`,
        orderId,
        orderLineId: `sd_${spec.key}_ol_${c.lineKey}`,
        completedAt: ago(c.daysAgo),
        note: c.note ?? null,
        recordedById: cat.users[c.recordedBy],
      },
    });
  }
}

function productKind(cat: Catalogue, productId: string): "PHYSICAL" | "SERVICE" | "SUBSCRIPTION" {
  const sku = skuOf(cat, productId);
  if (sku.startsWith("SVC")) return "SERVICE";
  if (sku.startsWith("SUB")) return "SUBSCRIPTION";
  return "PHYSICAL";
}

// ─────────────────────────────────────────────────────── subscriptions ──

interface SubSpec {
  key: string;
  orderKey: string;
  lineKey: string;
  sku: string;
  tier?: string;
  interval: RecurringInterval;
  qty: number;
  unitPriceMinor: number;
  discountBp: number;
  taxBp: number;
  status: "SCHEDULED" | "ACTIVE" | "PAUSE_SCHEDULED" | "PAUSED" | "CANCELLED";
  activationDaysAgo?: number;
  activationDaysAhead?: number;
  /** Completed billing periods (each has an invoice). The current period is unbilled. */
  periodsCompleted?: number;
  pauseRequestedDaysAgo?: number;
  resumeInDays?: number | null;
  cancelRequestedDaysAgo?: number;
  cancelMode?: "END_OF_PERIOD" | "IMMEDIATE";
  cancelEffectiveDaysAgo?: number;
  cancelledDaysAgo?: number;
}

interface ResolvedSub extends SubSpec {
  id: string;
  activation: Date;
  /** boundaries[n] = end of period n+1 = start of period n+2 (UTC, anchor-clamped). */
  boundaries: Date[];
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingDate: Date | null;
  pauseEffectiveAt: Date | null;
  cancelEffectiveAt: Date | null;
  cancelledAt: Date | null;
  periodStart: (periodIndex: number) => Date;
}

function resolveSub(spec: SubSpec): ResolvedSub {
  const activation =
    spec.activationDaysAgo != null ? ago(spec.activationDaysAgo) : ahead(spec.activationDaysAhead ?? 0);
  const anchorDay = activation.getUTCDate();
  const boundaries: Date[] = [];
  let cursor = activation;
  for (let i = 0; i < 20; i++) {
    cursor = periodEnd(spec.interval, cursor, anchorDay);
    boundaries.push(cursor);
  }
  const completed = spec.periodsCompleted ?? 0;
  const currentPeriodStart =
    spec.status === "SCHEDULED" || spec.status === "PAUSED" || spec.status === "CANCELLED"
      ? spec.status === "PAUSED"
        ? null
        : spec.status === "CANCELLED"
          ? null
          : null
      : completed === 0
        ? activation
        : boundaries[completed - 1];
  const currentPeriodEnd =
    spec.status === "ACTIVE" || spec.status === "PAUSE_SCHEDULED" ? boundaries[completed] : null;
  const nextBillingDate =
    spec.status === "SCHEDULED"
      ? activation
      : spec.status === "PAUSED"
        ? spec.resumeInDays == null
          ? null
          : ahead(spec.resumeInDays)
        : spec.status === "CANCELLED"
          ? null
          : (currentPeriodEnd ?? activation);
  const pauseEffectiveAt =
    spec.status === "PAUSED"
      ? boundaries[Math.max(0, completed - 1)]
      : spec.status === "PAUSE_SCHEDULED"
        ? (currentPeriodEnd ?? null)
        : null;
  const cancelEffectiveAt =
    spec.status === "CANCELLED"
      ? spec.cancelEffectiveDaysAgo != null
        ? ago(spec.cancelEffectiveDaysAgo)
        : null
      : spec.status === "ACTIVE" && spec.cancelEffectiveDaysAgo == null && spec.cancelRequestedDaysAgo != null
        ? (currentPeriodEnd ?? null) // END_OF_PERIOD pending
        : null;
  const periodStart = (periodIndex: number) =>
    periodIndex === 0 ? activation : boundaries[periodIndex - 1];
  return {
    ...spec,
    id: `sd_sub_${spec.key}`,
    activation,
    boundaries,
    currentPeriodStart,
    currentPeriodEnd,
    nextBillingDate,
    pauseEffectiveAt,
    cancelEffectiveAt,
    cancelledAt: spec.cancelledDaysAgo != null ? ago(spec.cancelledDaysAgo) : null,
    periodStart,
  };
}

interface ScheduleRow {
  periodStart: Date;
  periodEnd: Date;
  amountMinor: number;
  status: "UPCOMING" | "INVOICED" | "SKIPPED_PAUSED" | "SKIPPED_CANCELLED";
  invoiceId: string | null;
}

/**
 * Mirrors regenerateSchedule: INVOICED history survives, everything from the
 * regeneration boundary onward is rebuilt for scheduleHorizonPeriods (12).
 */
function buildSchedule(
  sub: ResolvedSub,
  invoiced: { periodIndex: number; invoiceId: string }[],
): ScheduleRow[] {
  const regenStart =
    sub.status === "PAUSED"
      ? (sub.pauseEffectiveAt ?? sub.activation)
      : sub.status === "CANCELLED"
        ? (sub.cancelEffectiveAt ?? sub.activation)
        : (sub.nextBillingDate ?? sub.activation);
  const pauseFrom = sub.pauseEffectiveAt;
  const pauseTo = sub.resumeInDays == null ? null : ahead(sub.resumeInDays);
  const cancelFrom =
    sub.status === "CANCELLED"
      ? (sub.cancelEffectiveAt ?? null)
      : sub.cancelEffectiveAt && sub.cancelEffectiveAt.getTime() > NOW
        ? sub.cancelEffectiveAt
        : null;
  const rows: ScheduleRow[] = [];
  let cursor = sub.activation;
  let future = 0;
  for (let index = 0; index < 40 && future < 12; index++) {
    const end = periodEnd(sub.interval, cursor, sub.activation.getUTCDate());
    const inv = invoiced.find((x) => x.periodIndex === index);
    let status: ScheduleRow["status"] = "UPCOMING";
    if (inv) status = "INVOICED";
    else if (cancelFrom && cursor.getTime() >= cancelFrom.getTime()) status = "SKIPPED_CANCELLED";
    else if (
      pauseFrom &&
      cursor.getTime() >= pauseFrom.getTime() &&
      (!pauseTo || cursor.getTime() < pauseTo.getTime())
    )
      status = "SKIPPED_PAUSED";
    const atOrAfterRegen = cursor.getTime() >= regenStart.getTime();
    if (atOrAfterRegen) future++;
    if (atOrAfterRegen || status === "INVOICED") {
      rows.push({
        periodStart: cursor,
        periodEnd: end,
        amountMinor: periodAmount(sub.qty, sub.unitPriceMinor, sub.discountBp),
        status,
        invoiceId: inv?.invoiceId ?? null,
      });
    }
    cursor = end;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────── main ──

export async function seedDemo(prisma: DbClient) {
  console.log("  demo: purging previous demo rows…");
  await purgeDemoData(prisma);
  await bumpSequences(prisma);

  // ── lookups ────────────────────────────────────────────────────────
  const emails = {
    admin: "arjun.admin@yopmail.com",
    vikram: "vikram.manager@yopmail.com",
    kavya: "kavya.manager@yopmail.com",
    priya: "priya.finance@yopmail.com",
    rahul: "rahul.rep@yopmail.com",
    sneha: "sneha.rep@yopmail.com",
    aarav: "aarav.sharma@yopmail.com",
    ananya: "ananya.mehta@yopmail.com",
    rohan: "rohan.gupta@yopmail.com",
    deepa: "deepa.reddy@yopmail.com",
  };
  const users: Record<string, string> = {};
  for (const [k, email] of Object.entries(emails)) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) throw new Error(`Missing seeded user ${email} — run base seed first`);
    users[k] = u.id;
  }

  const customerNames = [
    "Sharma Industries",
    "Mehta Logistics",
    "Gupta Retail",
    "Reddy Systems",
    "Iyer Pharma",
    "Chettiar Freight",
    "Patil Agro",
    "Nair Foods",
  ];
  const customers: Catalogue["customers"] = {};
  for (const name of customerNames) {
    const c = await prisma.customer.findFirst({ where: { name } });
    if (!c) throw new Error(`Missing customer ${name}`);
    customers[name] = {
      id: c.id,
      tier: c.tier as "BRONZE" | "SILVER" | "GOLD",
      priceListId: c.priceListId,
      currency: c.currency,
    };
  }

  const skus = [
    "LAP-PRO-14",
    "DOCK-STD",
    "MOUSE-WL",
    "KB-MECH",
    "CBL-USBC",
    "HW-RET-2019",
    "SVC-ONSITE",
    "SVC-TRAINING",
    "SVC-WARRANTY",
    "SUB-CARE",
    "SUB-SLA",
    "SUB-PHOTO",
  ];
  const products: Catalogue["products"] = {};
  for (const sku of skus) {
    const p = await prisma.product.findUnique({ where: { sku } });
    if (!p) throw new Error(`Missing product ${sku}`);
    products[sku] = {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      basePriceMinor: p.basePriceMinor,
      costPriceMinor: p.costPriceMinor,
      taxBp: p.taxBp,
      status: p.status,
    };
  }

  const lists: Catalogue["lists"] = {};
  for (const name of ["Standard INR", "Gold INR", "Silver INR", "Contract INR", "Legacy INR"]) {
    const l = await prisma.priceList.findFirst({ where: { name }, include: { items: true } });
    if (!l) continue;
    lists[l.id] = {
      rule: l.rule,
      percentOffBp: l.percentOffBp,
      items: new Map(l.items.map((i) => [i.productId, i.priceMinor])),
    };
  }

  const plans = new Map<
    string,
    { id: string; priceMinor: number; name: string; tierId: string | null; interval: RecurringInterval }
  >();
  for (const plan of await prisma.subscriptionPlan.findMany({ include: { tier: true, product: true } })) {
    if (!plan.tier) continue;
    plans.set(`${plan.product.sku}:${plan.tier.name}:${plan.interval}`, {
      id: plan.id,
      priceMinor: plan.priceMinor,
      name: plan.name,
      tierId: plan.tierId,
      interval: plan.interval,
    });
  }

  const variants = new Map<string, Map<string, { id: string; extra: number }>>();
  for (const attr of await prisma.variantAttribute.findMany({ include: { values: true } })) {
    const product = Object.entries(products).find(([, p]) => p.id === attr.productId)?.[0];
    if (!product) continue;
    const map = variants.get(`${product}:${attr.name}`) ?? new Map<string, { id: string; extra: number }>();
    for (const v of attr.values) map.set(v.value, { id: v.id, extra: v.extraPriceMinor });
    variants.set(`${product}:${attr.name}`, map);
  }

  const warehouses: Record<string, string> = {};
  for (const code of ["MAIN", "EAST", "WEST"]) {
    const w = await prisma.warehouse.findUnique({ where: { code } });
    if (w) warehouses[code] = w.id;
  }

  const activeRisk = await prisma.policyVersion.findFirst({ where: { kind: "DISCOUNT_RISK", isActive: true } });
  const activeFulfillment = await prisma.policyVersion.findFirst({ where: { kind: "FULFILLMENT", isActive: true } });
  if (!activeRisk || !activeFulfillment) throw new Error("Policy seed must run before demo seed");
  const policy = activeRisk.payload as unknown as DiscountRiskPolicy;
  const fulfillment = activeFulfillment.payload as unknown as FulfillmentPolicy;

  const cat: Catalogue = {
    policy,
    policyVersionId: activeRisk.id,
    fulfillment,
    users,
    customers,
    products,
    lists,
    plans,
    variants,
    warehouses,
  };

  // ── extra catalogue edges: inactive tier + inactive plan ───────────
  await prisma.planTier.create({
    data: {
      id: "sd_tier_legacy",
      productId: products["SUB-PHOTO"].id,
      name: "Legacy",
      rank: 3,
      isActive: false,
      description: "Retired tier kept for history.",
    },
  });
  await prisma.subscriptionPlan.create({
    data: {
      id: "sd_plan_care_weekly",
      productId: products["SUB-CARE"].id,
      tierId: null,
      name: "Standard weekly (retired)",
      interval: "WEEKLY",
      priceMinor: 12_900,
      isActive: false,
    },
  });

  // ── entitlement definitions & values ───────────────────────────────
  const defs = [
    { key: "seats", label: "Seats", unit: "seats", per: "CYCLE", valueType: "INT", sortOrder: 0, product: "SUB-PHOTO" },
    { key: "storage", label: "Storage", unit: "GB", per: "MONTH", valueType: "INT", sortOrder: 1, product: "SUB-PHOTO" },
    { key: "support", label: "Priority support", unit: null, per: "CYCLE", valueType: "BOOL", sortOrder: 2, product: "SUB-PHOTO" },
    { key: "retention", label: "Version retention", unit: null, per: "CYCLE", valueType: "TEXT", sortOrder: 3, product: "SUB-PHOTO" },
    { key: "api_calls", label: "API calls", unit: "calls", per: "DAY", valueType: "INT", sortOrder: 4, product: "SUB-PHOTO" },
    // `exports` deliberately has no values anywhere → UNSET cells everywhere.
    { key: "exports", label: "Bulk exports", unit: "files", per: "WEEK", valueType: "INT", sortOrder: 5, product: "SUB-PHOTO" },
    { key: "seats", label: "Seats", unit: "seats", per: "CYCLE", valueType: "INT", sortOrder: 0, product: "SUB-CARE" },
    { key: "onsite_visits", label: "Onsite visits", unit: "visits", per: "CYCLE", valueType: "INT", sortOrder: 1, product: "SUB-CARE" },
  ] as const;
  const defIds = new Map<string, string>();
  for (const d of defs) {
    const id = `sd_def_${d.product}_${d.key}`.toLowerCase();
    defIds.set(`${d.product}:${d.key}`, id);
    await prisma.entitlementDefinition.create({
      data: {
        id,
        productId: products[d.product].id,
        key: d.key,
        label: d.label,
        unit: d.unit,
        per: d.per,
        valueType: d.valueType,
        sortOrder: d.sortOrder,
      },
    });
  }
  const tierIds = new Map<string, string>();
  for (const t of await prisma.planTier.findMany({
    where: { product: { sku: { in: ["SUB-PHOTO", "SUB-CARE"] } } },
  })) {
    const sku = t.productId === products["SUB-PHOTO"].id ? "SUB-PHOTO" : "SUB-CARE";
    tierIds.set(`${sku}:${t.name}`, t.id);
  }
  const V = (product: string, tier: string, key: string, interval: RecurringInterval | null, value: unknown) => ({
    id: `sd_val_${product}_${tier}_${key}${interval ? `_${interval}` : ""}`.toLowerCase(),
    definitionId: defIds.get(`${product}:${key}`)!,
    tierId: tierIds.get(`${product}:${tier}`)!,
    interval,
    value: j(value),
    updatedById: users.admin,
  });
  await prisma.entitlementValue.createMany({
    data: [
      // Tier defaults (interval-null edge).
      V("SUB-PHOTO", "Pro", "seats", null, 5),
      V("SUB-PHOTO", "Plus", "seats", null, 20),
      V("SUB-PHOTO", "Pro Max", "seats", null, 100),
      V("SUB-PHOTO", "Pro", "support", null, true),
      V("SUB-PHOTO", "Plus", "support", null, false),
      V("SUB-PHOTO", "Pro Max", "support", null, true),
      V("SUB-PHOTO", "Pro", "api_calls", null, 1_000),
      V("SUB-PHOTO", "Plus", "api_calls", null, 25_000),
      V("SUB-PHOTO", "Pro Max", "api_calls", null, 100_000),
      // Interval-specific overrides (partial coverage: WEEKLY/QUARTERLY unset).
      V("SUB-PHOTO", "Pro", "storage", "MONTHLY", 50),
      V("SUB-PHOTO", "Pro", "storage", "YEARLY", 100),
      V("SUB-PHOTO", "Plus", "storage", "MONTHLY", 200),
      V("SUB-PHOTO", "Pro Max", "storage", "MONTHLY", 500),
      V("SUB-PHOTO", "Pro", "retention", "YEARLY", "180 days"),
      V("SUB-PHOTO", "Pro Max", "retention", "YEARLY", "365 days"),
      V("SUB-CARE", "Standard", "seats", null, 5),
      V("SUB-CARE", "Standard", "onsite_visits", null, 1),
    ],
  });
  const allDefs = await prisma.entitlementDefinition.findMany({
    where: { productId: { in: [products["SUB-PHOTO"].id, products["SUB-CARE"].id] } },
  });
  const allVals = await prisma.entitlementValue.findMany();
  const entitlementSnapshot = (sku: string, tier: string, interval: RecurringInterval) =>
    effectiveFor(
      allDefs.filter((d) => d.productId === products[sku].id),
      allVals.filter((v) => v.tierId === tierIds.get(`${sku}:${tier}`)),
      tierIds.get(`${sku}:${tier}`)!,
      interval,
    );

  // ── policy version history edge ────────────────────────────────────
  const riskV2 = await prisma.policyVersion.create({
    data: {
      id: "sd_policy_risk_v2",
      kind: "DISCOUNT_RISK",
      version: 2,
      payload: j({ ...policy, tierCeilingsBp: { BRONZE: 400, SILVER: 900, GOLD: 1400 } }),
      isActive: false,
      publishedById: users.admin,
      publishedAt: ago(20),
      reason: "Tighten tier ceilings after Q1 margin review",
    },
  });
  await prisma.auditLog.create({
    data: {
      id: "sd_audit_policy_risk_v2",
      actorId: users.admin,
      actorType: "USER",
      entityType: "PolicyVersion",
      entityId: riskV2.id,
      action: "POLICY.PUBLISHED",
      version: 2,
      after: j({ kind: "DISCOUNT_RISK", version: 2 }),
      reason: "Tighten tier ceilings after Q1 margin review",
      createdAt: ago(20),
    },
  });

  // ── upsell / co-purchase rules ─────────────────────────────────────
  const upsell = [
    ["LAP-PRO-14", "DOCK-STD", 5, "MANUAL"],
    ["LAP-PRO-14", "MOUSE-WL", 3, "COPURCHASE"],
    ["LAP-PRO-14", "CBL-USBC", 2, "COPURCHASE"],
    ["LAP-PRO-14", "KB-MECH", 1, "MANUAL"],
    ["LAP-PRO-14", "HW-RET-2019", 4, "MANUAL"], // suggests an archived product → filtered at runtime
    ["DOCK-STD", "LAP-PRO-14", 2, "COPURCHASE"],
    ["MOUSE-WL", "LAP-PRO-14", 1, "COPURCHASE"],
    ["SVC-ONSITE", "SVC-WARRANTY", 2, "MANUAL"],
  ] as const;
  for (const [from, to, weight, source] of upsell) {
    await prisma.upsellRule.create({
      data: {
        id: `sd_ups_${from}_${to}`.toLowerCase(),
        productId: products[from].id,
        suggestedProductId: products[to].id,
        weight,
        source,
      },
    });
  }

  // Publish co-purchase rules as RECOMMENDATION v2 when v1 is still the default.
  const recV1 = await prisma.policyVersion.findFirst({ where: { kind: "RECOMMENDATION", version: 1 } });
  const recV1Rules = (recV1?.payload as { rules?: unknown[] } | null)?.rules ?? [];
  if (recV1 && recV1Rules.length === 0) {
    await prisma.policyVersion.update({ where: { id: recV1.id }, data: { isActive: false } });
    const recV2 = await prisma.policyVersion.create({
      data: {
        id: "sd_policy_rec_v2",
        kind: "RECOMMENDATION",
        version: 2,
        payload: j({
          maxSuggestions: 4,
          promotedBoost: 3,
          promotions: { [products["CBL-USBC"].id]: 500 },
          enforceMinMargin: true,
          rules: upsell.map(([from, to, weight, source]) => ({
            productId: products[from].id,
            suggestedProductId: products[to].id,
            weight,
            source,
          })),
        }),
        isActive: true,
        publishedById: users.admin,
        publishedAt: ago(10),
        reason: "Activate mined co-purchase relationships",
      },
    });
    await prisma.auditLog.create({
      data: {
        id: "sd_audit_policy_rec_v2",
        actorId: users.admin,
        actorType: "USER",
        entityType: "PolicyVersion",
        entityId: recV2.id,
        action: "POLICY.PUBLISHED",
        version: 2,
        after: j({ kind: "RECOMMENDATION", version: 2 }),
        reason: "Activate mined co-purchase relationships",
        createdAt: ago(10),
      },
    });
  }

  // ── quotations ─────────────────────────────────────────────────────
  const quoteSpecs: QuoteSpec[] = [
    {
      key: "q01",
      number: 9501,
      customer: "Gupta Retail",
      owner: "rahul",
      status: "DRAFT",
      revisions: [
        { reason: "Quotation created", daysAgo: 3, lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2 }] },
        {
          reason: "Line added",
          daysAgo: 2,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 2 },
            { key: "dock", sku: "DOCK-STD", qty: 1 },
          ],
        },
      ],
      customerNote: "Please include GST breakup.",
    },
    {
      key: "q02",
      number: 9502,
      customer: "Sharma Industries",
      owner: "sneha",
      status: "DRAFT",
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 1,
          orderDiscountBp: 200,
          lines: [
            {
              key: "lap",
              sku: "LAP-PRO-14",
              qty: 1,
              discountBp: 1000,
              variants: [
                ["Size", "16 inch"],
                ["RAM", "32 GB"],
              ],
            },
            { key: "svc", sku: "SVC-ONSITE", qty: 1, discountBp: 500 },
            { key: "care", sku: "SUB-CARE", qty: 10, tier: "Standard", interval: "MONTHLY", addedFromUpsell: true },
          ],
        },
      ],
    },
    {
      key: "q03",
      number: 9503,
      customer: "Gupta Retail",
      owner: "rahul",
      status: "DRAFT",
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 5,
          lines: [
            { key: "mouse", sku: "MOUSE-WL", qty: 1, discountBp: 10000 }, // 100 % line discount edge
            { key: "care", sku: "SUB-CARE", qty: 1, tier: "Standard", interval: "MONTHLY", discountBp: 500 }, // Subscriptions ceiling is 0
          ],
        },
      ],
    },
    {
      key: "q04",
      number: 9504,
      customer: "Sharma Industries",
      owner: "rahul",
      status: "PENDING_APPROVAL",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 1,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 3, discountBp: 1700 }, // excess 200 → level 1
            { key: "svc", sku: "SVC-ONSITE", qty: 1, discountBp: 500 },
          ],
        },
      ],
      validUntilDays: 30,
    },
    {
      key: "q05",
      number: 9505,
      customer: "Reddy Systems",
      owner: "sneha",
      status: "PENDING_APPROVAL",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 1,
          orderDiscountBp: 300,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 5, discountBp: 2300 }, // worst excess 800 → level 2
            { key: "training", sku: "SVC-TRAINING", qty: 1 }, // negative-margin line
          ],
        },
      ],
      validUntilDays: 21,
    },
    {
      key: "q06",
      number: 9506,
      customer: "Iyer Pharma",
      owner: "rahul",
      status: "APPROVED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 4,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 1200 }], // SILVER ceiling 1000 → excess 200
        },
      ],
      validUntilDays: 25,
    },
    {
      key: "q07",
      number: 9507,
      customer: "Mehta Logistics",
      owner: "sneha",
      status: "SENT",
      approvedVersion: 2,
      revisions: [
        { reason: "Quotation created", daysAgo: 6, lines: [{ key: "dock", sku: "DOCK-STD", qty: 20, discountBp: 1400 }] },
        { reason: "Quotation terms updated", daysAgo: 4, lines: [{ key: "dock", sku: "DOCK-STD", qty: 25, discountBp: 1400 }] },
      ],
      sentDaysAgo: 2,
      validUntilDays: 28,
      portalToken: true,
    },
    {
      key: "q08",
      number: 9508,
      customer: "Sharma Industries",
      owner: "rahul",
      status: "UNDER_NEGOTIATION",
      approvedVersion: 2,
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 8,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 1500 }], // within GOLD → auto-approved
        },
        {
          reason: "PROPOSAL.APPLY",
          daysAgo: 3,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 2000 }], // excess 500 → level 1 re-route
        },
      ],
      sentDaysAgo: 7,
      validUntilDays: 20,
      portalToken: true,
      requestedDeliveryDays: 21,
      customerNote: "Festival-season deployment.",
    },
    {
      key: "q09",
      number: 9509,
      customer: "Gupta Retail",
      owner: "rahul",
      status: "REVISION_REQUESTED",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 2,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 900 }], // excess 400 → level 1
        },
      ],
      validUntilDays: 25,
    },
    {
      key: "q10",
      number: 9510,
      customer: "Gupta Retail",
      owner: "sneha",
      status: "REJECTED",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 6,
          lines: [{ key: "mouse", sku: "MOUSE-WL", qty: 10, discountBp: 10000 }], // 100 % → level 2
        },
      ],
      validUntilDays: 18,
    },
    {
      key: "q11",
      number: 9511,
      customer: "Iyer Pharma",
      owner: "rahul",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 5,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 1100 }, // excess 100 → level 1
            { key: "mouse", sku: "MOUSE-WL", qty: 4 },
            { key: "care", sku: "SUB-CARE", qty: 5, tier: "Standard", interval: "MONTHLY" },
          ],
        },
      ],
      sentDaysAgo: 4,
      confirmedDaysAgo: 1,
      validUntilDays: 29,
      requestedDeliveryDays: 12,
      portalToken: true,
    },
    {
      key: "q12",
      number: 9512,
      customer: "Sharma Industries",
      owner: "sneha",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 76,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 3, discountBp: 1000 }, // within GOLD → level 0
            { key: "photo", sku: "SUB-PHOTO", qty: 25, tier: "Plus", interval: "MONTHLY" },
            { key: "care", sku: "SUB-CARE", qty: 8, tier: "Standard", interval: "QUARTERLY" },
          ],
        },
      ],
      sentDaysAgo: 75,
      confirmedDaysAgo: 75,
      validUntilDays: 60,
      portalToken: true,
    },
    {
      key: "q13",
      number: 9513,
      customer: "Chettiar Freight",
      owner: "rahul",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 9,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 4, discountBp: 2400 }, // contract price → worst excess 900 → level 2
            { key: "dock", sku: "DOCK-STD", qty: 2, discountBp: 1000 },
            { key: "kb", sku: "KB-MECH", qty: 5 },
            { key: "cbl", sku: "CBL-USBC", qty: 10 },
          ],
        },
      ],
      sentDaysAgo: 8,
      confirmedDaysAgo: 7,
      validUntilDays: 23,
      requestedDeliveryDays: 10,
      portalToken: true,
    },
    {
      key: "q14",
      number: 9514,
      customer: "Mehta Logistics",
      owner: "sneha",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 14,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 5, discountBp: 1300 }, // excess 300 → level 1
            { key: "mouse", sku: "MOUSE-WL", qty: 10, discountBp: 500 },
            { key: "cbl", sku: "CBL-USBC", qty: 5 },
            { key: "care", sku: "SUB-CARE", qty: 2, tier: "Standard", interval: "MONTHLY" },
            { key: "photo", sku: "SUB-PHOTO", qty: 10, tier: "Pro", interval: "MONTHLY" },
          ],
        },
      ],
      sentDaysAgo: 13,
      confirmedDaysAgo: 12,
      validUntilDays: 18,
      requestedDeliveryDays: 7,
      portalToken: true,
    },
    {
      key: "q15",
      number: 9515,
      customer: "Reddy Systems",
      owner: "rahul",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 24,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 2400 }, // excess 900 → level 2
            { key: "svc", sku: "SVC-ONSITE", qty: 1 },
            { key: "cbl", sku: "CBL-USBC", qty: 8 },
            { key: "care", sku: "SUB-CARE", qty: 3, tier: "Standard", interval: "MONTHLY" },
          ],
        },
      ],
      sentDaysAgo: 23,
      confirmedDaysAgo: 22,
      validUntilDays: 8,
      requestedDeliveryDays: -2, // already slipped
      portalToken: true,
    },
    {
      key: "q16",
      number: 9516,
      customer: "Sharma Industries",
      owner: "sneha",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 100,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 1, discountBp: 1700 }, // excess 200 → level 1
            { key: "warranty", sku: "SVC-WARRANTY", qty: 1 },
            { key: "photo", sku: "SUB-PHOTO", qty: 30, tier: "Pro", interval: "YEARLY" },
          ],
        },
      ],
      sentDaysAgo: 99,
      confirmedDaysAgo: 98,
      validUntilDays: 5,
      portalToken: true,
    },
    {
      key: "q17",
      number: 9517,
      customer: "Gupta Retail",
      owner: "rahul",
      status: "EXPIRED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 46,
          lines: [
            { key: "mouse", sku: "MOUSE-WL", qty: 5 },
            { key: "lap", sku: "LAP-PRO-14", qty: 1 },
          ],
        },
      ],
      sentDaysAgo: 45,
      lastActivityDaysAgo: 45,
      validUntilDays: -15,
      portalToken: true,
    },
    {
      key: "q18",
      number: 9518,
      customer: "Iyer Pharma",
      owner: "sneha",
      status: "CANCELLED",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 11,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 1, discountBp: 1200 }], // level 1
        },
      ],
      lastActivityDaysAgo: 9,
      validUntilDays: 19,
    },
    {
      key: "q19",
      number: 9519,
      customer: "Reddy Systems",
      owner: "rahul",
      status: "DRAFT",
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 2,
          lines: [
            { key: "photo", sku: "SUB-PHOTO", qty: 12, tier: "Pro", interval: "WEEKLY" },
            { key: "care", sku: "SUB-CARE", qty: 2, tier: "Standard", interval: "YEARLY" },
          ],
        },
      ],
    },
    {
      key: "q20",
      number: 9520,
      customer: "Gupta Retail",
      owner: "rahul",
      status: "DRAFT",
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 1,
          lines: [
            { key: "care", sku: "SUB-CARE", qty: 4, tier: "Standard", interval: "MONTHLY", discountBp: 300 }, // Subscriptions ceiling 0
            { key: "cbl", sku: "CBL-USBC", qty: 1 },
          ],
        },
      ],
    },
    {
      key: "q21",
      number: 9521,
      customer: "Mehta Logistics",
      owner: "sneha",
      status: "PENDING_APPROVAL",
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 2,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 2300 }], // excess 1300 → level 2
        },
      ],
      validUntilDays: 24,
    },
    {
      key: "q22",
      number: 9522,
      customer: "Iyer Pharma",
      owner: "rahul",
      status: "APPROVED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 14,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 1, discountBp: 500 }], // within ceilings → level 0
        },
      ],
      sentDaysAgo: 13,
      lastActivityDaysAgo: 12,
      validUntilDays: 17,
      portalToken: true,
    },
    {
      key: "q23",
      number: 9523,
      customer: "Sharma Industries",
      owner: "sneha",
      status: "DRAFT",
      revisions: [
        {
          reason: "Quotation created",
          daysAgo: 1,
          lines: [{ key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 3200 }], // anomaly vs. the account's 900bp average
        },
      ],
    },
    {
      key: "q24",
      number: 9524,
      customer: "Chettiar Freight",
      owner: "rahul",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 12,
          lines: [
            { key: "lap", sku: "LAP-PRO-14", qty: 2, discountBp: 1700 }, // excess 200 → level 1
            { key: "warranty", sku: "SVC-WARRANTY", qty: 1 },
            { key: "care", sku: "SUB-CARE", qty: 4, tier: "Standard", interval: "YEARLY" },
          ],
        },
      ],
      sentDaysAgo: 11,
      confirmedDaysAgo: 10,
      validUntilDays: 20,
      requestedDeliveryDays: -2, // already slipped → delivery alert
      portalToken: true,
    },
    {
      key: "q25",
      number: 9525,
      customer: "Nair Foods",
      owner: "sneha",
      status: "DRAFT",
      revisions: [{ reason: "Quotation created", daysAgo: 1, lines: [] }], // empty quote edge
    },
    {
      key: "q26",
      number: 9526,
      customer: "Patil Agro",
      owner: "rahul",
      status: "CONFIRMED",
      approvedVersion: 1,
      revisions: [
        {
          reason: "SUBMIT",
          daysAgo: 16,
          lines: [
            { key: "dock", sku: "DOCK-STD", qty: 2, discountBp: 300 }, // within BRONZE 500 → level 0
            { key: "lap", sku: "LAP-PRO-14", qty: 1 },
          ],
        },
      ],
      sentDaysAgo: 15,
      confirmedDaysAgo: 14,
      validUntilDays: 14,
      portalToken: true,
    },
  ];

  const quotes = new Map<string, BuiltQuote>();
  for (const spec of quoteSpecs) {
    const built = buildQuote(cat, spec);
    await persistQuote(prisma, cat, built);
    quotes.set(spec.key, built);
  }

  // ── approvals for every request/step state ─────────────────────────
  await addApproval(prisma, cat, quotes.get("q04")!, {
    id: "sd_apr_q04",
    version: 1,
    requiredLevel: 1,
    status: "PENDING",
    currentStepIndex: 0,
    steps: [{ role: "SALES_MANAGER", status: "PENDING", assignee: "vikram", dueInHours: 18 }],
  });
  await addApproval(prisma, cat, quotes.get("q05")!, {
    id: "sd_apr_q05",
    version: 1,
    requiredLevel: 2,
    status: "PENDING",
    currentStepIndex: 0,
    steps: [
      { role: "SALES_MANAGER", status: "PENDING", assignee: "vikram", dueInHours: 10 },
      { role: "FINANCE", status: "WAITING", assignee: "priya" }, // WAITING edge: dueAt stays null
    ],
  });
  await addApproval(prisma, cat, quotes.get("q06")!, {
    id: "sd_apr_q06",
    version: 1,
    requiredLevel: 1,
    status: "APPROVED",
    currentStepIndex: 0,
    decidedDaysAgo: 3,
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", assignee: "kavya", decidedBy: "kavya", decidedDaysAgo: 3, note: "Standard renewal discount." },
    ],
  });
  await addApproval(prisma, cat, quotes.get("q07")!, {
    id: "sd_apr_q07_v1",
    version: 1,
    requiredLevel: 1,
    status: "APPROVED",
    currentStepIndex: 0,
    decidedDaysAgo: 5,
    steps: [{ role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 5 }],
  });
  await addApproval(prisma, cat, quotes.get("q07")!, {
    id: "sd_apr_q07_v2",
    version: 2,
    requiredLevel: 1,
    status: "APPROVED",
    currentStepIndex: 0,
    decidedDaysAgo: 3,
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 3, note: "Volume bump approved." },
    ],
  });
  await addApproval(prisma, cat, quotes.get("q08")!, {
    id: "sd_apr_q08",
    version: 2,
    requiredLevel: 1,
    status: "APPROVED",
    currentStepIndex: 0,
    decidedDaysAgo: 2,
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 2, note: "Matched competitor rate." },
    ],
  });
  await addApproval(prisma, cat, quotes.get("q09")!, {
    id: "sd_apr_q09",
    version: 1,
    requiredLevel: 1,
    status: "RETURNED",
    currentStepIndex: 0,
    decidedDaysAgo: 1,
    steps: [
      { role: "SALES_MANAGER", status: "RETURNED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 1, note: "Add the AMC line before we approve." },
    ],
  });
  await addApproval(prisma, cat, quotes.get("q10")!, {
    id: "sd_apr_q10",
    version: 1,
    requiredLevel: 2,
    status: "REJECTED",
    currentStepIndex: 1,
    decidedDaysAgo: 5,
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 6 },
      { role: "FINANCE", status: "REJECTED", assignee: "priya", decidedBy: "priya", decidedDaysAgo: 5, note: "Zero-margin bundle declined." },
    ],
  });
  for (const key of ["q11", "q14", "q16", "q24"]) {
    const q = quotes.get(key)!;
    await addApproval(prisma, cat, q, {
      id: `sd_apr_${key}`,
      version: 1,
      requiredLevel: 1,
      status: "APPROVED",
      currentStepIndex: 0,
      decidedDaysAgo: q.spec.confirmedDaysAgo! + 1,
      steps: [
        { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: q.spec.confirmedDaysAgo! + 1 },
      ],
    });
  }
  for (const key of ["q13", "q15"]) {
    const q = quotes.get(key)!;
    await addApproval(prisma, cat, q, {
      id: `sd_apr_${key}`,
      version: 1,
      requiredLevel: 2,
      status: "APPROVED",
      currentStepIndex: 1,
      decidedDaysAgo: q.spec.confirmedDaysAgo! + 1,
      steps: [
        { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: q.spec.confirmedDaysAgo! + 2 },
        { role: "FINANCE", status: "APPROVED", assignee: "priya", decidedBy: "priya", decidedDaysAgo: q.spec.confirmedDaysAgo! + 1, note: "Margin acceptable at this volume." },
      ],
    });
  }
  await addApproval(prisma, cat, quotes.get("q18")!, {
    id: "sd_apr_q18",
    version: 1,
    requiredLevel: 1,
    status: "SUPERSEDED",
    currentStepIndex: 0,
    steps: [{ role: "SALES_MANAGER", status: "SUPERSEDED", assignee: "vikram" }],
  });
  await addApproval(prisma, cat, quotes.get("q21")!, {
    id: "sd_apr_q21",
    version: 1,
    requiredLevel: 2,
    status: "PENDING",
    currentStepIndex: 1,
    steps: [
      { role: "SALES_MANAGER", status: "APPROVED", assignee: "vikram", decidedBy: "vikram", decidedDaysAgo: 1, note: "Strategic account, forwarding." },
      { role: "FINANCE", status: "PENDING", assignee: "priya", dueInHours: -6 }, // overdue → SLA alert
    ],
  });

  // ── negotiation on q08 (all authors, all proposal statuses) ────────
  const q08 = quotes.get("q08")!;
  const lapLineId = q08.lineIds.get("lap")!;
  await prisma.negotiationMessage.createMany({
    data: [
      {
        id: "sd_msg_1",
        quotationId: q08.id,
        quotationVersion: 1,
        lineId: lapLineId,
        author: "CUSTOMER",
        authorUserId: users.aarav,
        body: "Can we do three units instead of two?",
        proposedQty: 3,
        status: "WITHDRAWN",
        respondedAt: ago(6),
        createdAt: ago(7),
      },
      {
        id: "sd_msg_2",
        quotationId: q08.id,
        quotationVersion: 1,
        lineId: lapLineId,
        author: "CUSTOMER",
        authorUserId: users.aarav,
        body: "Matching a competitor quote at 20% off — can you meet this?",
        counterDiscountBp: 2000,
        status: "APPLIED",
        respondedAt: ago(3),
        createdAt: ago(4),
      },
      {
        id: "sd_msg_3",
        quotationId: q08.id,
        quotationVersion: 2,
        author: "SYSTEM",
        authorUserId: users.rahul,
        body: "Proposal applied.",
        status: "APPLIED",
        respondedAt: ago(3),
        createdAt: ago(3),
      },
      {
        id: "sd_msg_4",
        quotationId: q08.id,
        quotationVersion: 2,
        lineId: lapLineId,
        author: "CUSTOMER",
        authorUserId: users.aarav,
        body: "Can you stretch to 12% on the laptops?",
        counterDiscountBp: 1200,
        status: "OPEN",
        createdAt: ago(2),
      },
      {
        id: "sd_msg_5",
        quotationId: q08.id,
        quotationVersion: 2,
        author: "INTERNAL",
        authorUserId: users.rahul,
        body: "Finance can go to 10% at best for this volume.",
        status: "OPEN",
        createdAt: ago(2),
      },
      {
        id: "sd_msg_6",
        quotationId: q08.id,
        quotationVersion: 1,
        lineId: lapLineId,
        author: "CUSTOMER",
        authorUserId: users.aarav,
        body: "Free on-site installation please.",
        status: "DECLINED",
        respondedAt: ago(5),
        createdAt: ago(6),
      },
      {
        id: "sd_msg_7",
        quotationId: q08.id,
        quotationVersion: 2,
        author: "CUSTOMER",
        authorUserId: users.aarav,
        body: "Delivery before Diwali, please.",
        requestedDeliveryDate: ahead(21),
        status: "OPEN",
        createdAt: ago(1),
      },
    ],
  });

  // ── orders & fulfilment ────────────────────────────────────────────
  await createOrder(prisma, cat, quotes, {
    key: "o01",
    number: 9501,
    quoteKey: "q11",
    status: "OPEN",
    fulfillmentStatus: "UNALLOCATED",
    plan: {
      status: "SUGGESTED", // proposed but not accepted → allocations reserved:false
      method: "EXHAUSTIVE",
      allocations: [
        { lineKey: "lap", warehouse: "MAIN", qty: 2 },
        { lineKey: "mouse", warehouse: "MAIN", qty: 4 },
      ],
    },
  });
  await createOrder(prisma, cat, quotes, {
    key: "o02",
    number: 9502,
    quoteKey: "q12",
    status: "OPEN",
    fulfillmentStatus: "RESERVED",
    plan: {
      status: "ACCEPTED",
      method: "EXHAUSTIVE",
      decidedBy: "vikram",
      decidedDaysAgo: 73,
      allocations: [
        { lineKey: "lap", warehouse: "MAIN", qty: 2 },
        { lineKey: "lap", warehouse: "EAST", qty: 1 },
      ],
    },
    shipments: [
      { key: "mum", number: 9501, warehouse: "MAIN", status: "PLANNED", lines: [{ lineKey: "lap", qty: 2 }] },
      { key: "kol", number: 9502, warehouse: "EAST", status: "PLANNED", lines: [{ lineKey: "lap", qty: 1 }] },
    ],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o03",
    number: 9503,
    quoteKey: "q13",
    status: "OPEN",
    fulfillmentStatus: "BACKORDERED",
    plan: {
      status: "ACCEPTED",
      method: "EXHAUSTIVE",
      decidedBy: "vikram",
      decidedDaysAgo: 6,
      allocations: [
        { lineKey: "lap", warehouse: "MAIN", qty: 4 },
        { lineKey: "dock", warehouse: "MAIN", qty: 2 },
        { lineKey: "kb", warehouse: "MAIN", qty: 3 },
      ],
      backorders: [
        { lineKey: "kb", qty: 2, status: "OPEN" },
        { lineKey: "cbl", qty: 10, status: "CONSOLIDATION_SUGGESTED", suggested: { warehouse: "EAST", qty: 4 } },
      ],
    },
    shipments: [
      {
        key: "mum",
        number: 9503,
        warehouse: "MAIN",
        status: "PLANNED",
        lines: [
          { lineKey: "lap", qty: 4 },
          { lineKey: "dock", qty: 2 },
          { lineKey: "kb", qty: 3 },
        ],
      },
    ],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o04",
    number: 9504,
    quoteKey: "q14",
    status: "OPEN",
    fulfillmentStatus: "PARTIALLY_FULFILLED",
    plan: {
      status: "ACCEPTED",
      method: "EXHAUSTIVE",
      decidedBy: "vikram",
      decidedDaysAgo: 11,
      allocations: [
        { lineKey: "lap", warehouse: "MAIN", qty: 3, qtyShipped: 3 },
        { lineKey: "lap", warehouse: "EAST", qty: 2 },
        { lineKey: "mouse", warehouse: "MAIN", qty: 4, qtyShipped: 4 },
        { lineKey: "mouse", warehouse: "EAST", qty: 6 },
        { lineKey: "cbl", warehouse: "MAIN", qty: 5, qtyShipped: 3 },
      ],
      backorders: [{ lineKey: "cbl", qty: 2, status: "ALLOCATED" }], // consolidated historically
    },
    shipments: [
      {
        key: "mum",
        number: 9504,
        warehouse: "MAIN",
        status: "SHIPPED",
        shippedDaysAgo: 6,
        shippedBy: "rahul",
        lines: [
          { lineKey: "lap", qty: 3 },
          { lineKey: "mouse", qty: 4 },
          { lineKey: "cbl", qty: 3 },
        ],
      },
      {
        key: "kol",
        number: 9505,
        warehouse: "EAST",
        status: "PLANNED",
        lines: [
          { lineKey: "lap", qty: 2 },
          { lineKey: "mouse", qty: 6 },
        ],
      },
    ],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o05",
    number: 9505,
    quoteKey: "q15",
    status: "OPEN", // fulfilled but not completed — invoices still unsettled
    fulfillmentStatus: "FULFILLED",
    plan: {
      status: "ACCEPTED",
      method: "EXHAUSTIVE",
      decidedBy: "vikram",
      decidedDaysAgo: 21,
      allocations: [
        { lineKey: "lap", warehouse: "MAIN", qty: 2, qtyShipped: 2 },
        { lineKey: "cbl", warehouse: "MAIN", qty: 8, qtyShipped: 8 },
      ],
    },
    shipments: [
      {
        key: "mum",
        number: 9506,
        warehouse: "MAIN",
        status: "SHIPPED",
        shippedDaysAgo: 20,
        shippedBy: "sneha",
        lines: [
          { lineKey: "lap", qty: 2 },
          { lineKey: "cbl", qty: 8 },
        ],
      },
    ],
    completions: [{ lineKey: "svc", daysAgo: 18, note: "Installed at Andheri site.", recordedBy: "rahul" }],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o06",
    number: 9506,
    quoteKey: "q16",
    status: "COMPLETED", // the only fully settled order
    fulfillmentStatus: "FULFILLED",
    plan: {
      status: "ACCEPTED",
      method: "EXHAUSTIVE",
      decidedBy: "kavya",
      decidedDaysAgo: 97,
      allocations: [{ lineKey: "lap", warehouse: "MAIN", qty: 1, qtyShipped: 1 }],
    },
    shipments: [
      {
        key: "mum",
        number: 9507,
        warehouse: "MAIN",
        status: "SHIPPED",
        shippedDaysAgo: 96,
        shippedBy: "sneha",
        lines: [{ lineKey: "lap", qty: 1 }],
      },
    ],
    completions: [{ lineKey: "warranty", daysAgo: 95, note: null, recordedBy: "sneha" }],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o07",
    number: 9507,
    quoteKey: "q24",
    status: "OPEN",
    fulfillmentStatus: "RESERVED",
    plan: {
      status: "OVERRIDDEN", // manual override edge
      method: "MANUAL",
      decidedBy: "vikram",
      decidedDaysAgo: 8,
      allocations: [{ lineKey: "lap", warehouse: "MAIN", qty: 2 }],
    },
    shipments: [{ key: "mum", number: 9508, warehouse: "MAIN", status: "PLANNED", lines: [{ lineKey: "lap", qty: 2 }] }],
  });
  await createOrder(prisma, cat, quotes, {
    key: "o08",
    number: 9508,
    quoteKey: "q26",
    status: "CANCELLED",
    fulfillmentStatus: "UNALLOCATED",
  });

  // ── quote acceptances ──────────────────────────────────────────────
  await prisma.quoteAcceptance.createMany({
    data: [
      { id: "sd_acc_q11", quotationId: quotes.get("q11")!.id, version: 1, customerUserId: users.deepa, acceptedAt: ago(1), ipAddress: "49.36.181.12" },
      { id: "sd_acc_q16", quotationId: quotes.get("q16")!.id, version: 1, customerUserId: users.aarav, acceptedAt: ago(98), ipAddress: "103.21.58.4" },
      { id: "sd_acc_q26", quotationId: quotes.get("q26")!.id, version: 1, customerUserId: users.rohan, acceptedAt: ago(14), ipAddress: null },
    ],
  });

  // ── subscriptions ──────────────────────────────────────────────────
  const careStandard = (interval: RecurringInterval) => ({
    plan: plans.get(`SUB-CARE:Standard:${interval}`)!,
    sku: "SUB-CARE",
    tier: "Standard",
    interval,
  });
  const photoPlan = (tier: string, interval: RecurringInterval) => ({
    plan: plans.get(`SUB-PHOTO:${tier}:${interval}`)!,
    sku: "SUB-PHOTO",
    tier,
    interval,
  });

  const subSpecs: SubSpec[] = [
    {
      key: "s1",
      orderKey: "o01",
      lineKey: "care",
      sku: "SUB-CARE",
      tier: "Standard",
      interval: "MONTHLY",
      qty: 5,
      unitPriceMinor: careStandard("MONTHLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-CARE"].taxBp,
      status: "SCHEDULED",
      activationDaysAhead: 10, // finance moved activation out → future-dated
    },
    {
      key: "s2",
      orderKey: "o02",
      lineKey: "photo",
      ...photoPlan("Plus", "MONTHLY"),
      qty: 25,
      unitPriceMinor: photoPlan("Plus", "MONTHLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-PHOTO"].taxBp,
      status: "ACTIVE",
      activationDaysAgo: 75,
      periodsCompleted: 2,
      pauseRequestedDaysAgo: 70, // paused & resumed at the p1 boundary — history edge
    },
    {
      key: "s3",
      orderKey: "o05",
      lineKey: "care",
      ...careStandard("MONTHLY"),
      qty: 3,
      unitPriceMinor: careStandard("MONTHLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-CARE"].taxBp,
      status: "ACTIVE",
      activationDaysAgo: 45,
      periodsCompleted: 1,
    },
    {
      key: "s4",
      orderKey: "o06",
      lineKey: "photo",
      ...photoPlan("Pro", "YEARLY"),
      qty: 30, // 20 → 50 (charge) → 50 → 30 (credit); qty lives on the order line as 30
      unitPriceMinor: photoPlan("Pro", "YEARLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-PHOTO"].taxBp,
      status: "ACTIVE",
      activationDaysAgo: 200,
      periodsCompleted: 0,
    },
    {
      key: "s5",
      orderKey: "o02",
      lineKey: "care",
      ...careStandard("QUARTERLY"),
      qty: 8,
      unitPriceMinor: careStandard("QUARTERLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-CARE"].taxBp,
      status: "PAUSED",
      activationDaysAgo: 120,
      periodsCompleted: 1,
      pauseRequestedDaysAgo: 35,
      resumeInDays: 45,
    },
    {
      key: "s6",
      orderKey: "o04",
      lineKey: "care",
      ...careStandard("MONTHLY"),
      qty: 2,
      unitPriceMinor: careStandard("MONTHLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-CARE"].taxBp,
      status: "ACTIVE",
      activationDaysAgo: 80,
      periodsCompleted: 2,
      cancelRequestedDaysAgo: 3, // END_OF_PERIOD: takes effect at the upcoming boundary
      cancelMode: "END_OF_PERIOD",
    },
    {
      key: "s7",
      orderKey: "o07",
      lineKey: "care",
      ...careStandard("YEARLY"),
      qty: 4,
      unitPriceMinor: careStandard("YEARLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-CARE"].taxBp,
      status: "CANCELLED",
      activationDaysAgo: 400,
      periodsCompleted: 0,
      cancelEffectiveDaysAgo: 30, // IMMEDIATE cancellation already processed
      cancelledDaysAgo: 30,
    },
    {
      key: "s8",
      orderKey: "o04",
      lineKey: "photo",
      ...photoPlan("Pro", "MONTHLY"),
      qty: 10,
      unitPriceMinor: photoPlan("Pro", "MONTHLY").plan.priceMinor,
      discountBp: 0,
      taxBp: products["SUB-PHOTO"].taxBp,
      status: "PAUSE_SCHEDULED",
      activationDaysAgo: 25,
      periodsCompleted: 0,
      pauseRequestedDaysAgo: 2,
    },
  ];

  const subs = subSpecs.map(resolveSub);
  const subIds = new Map(subs.map((s) => [s.key, s.id]));
  const quoteOfOrder = (orderKey: string) => orderKey.replace("o0", "q0");

  for (const sub of subs) {
    const plan = sub.tier ? plans.get(`${sub.sku}:${sub.tier}:${sub.interval}`)! : null;
    const snapshot = plan?.tierId && sub.tier ? entitlementSnapshot(sub.sku, sub.tier, sub.interval) : {};
    await prisma.subscription.create({
      data: {
        id: sub.id,
        orderId: `sd_${sub.orderKey}`,
        orderLineId: `sd_${sub.orderKey}_ol_${sub.lineKey}`,
        customerId: cat.customers[quotes.get(quoteOfOrder(sub.orderKey))!.spec.customer].id,
        planId: plan!.id,
        qty: sub.qty,
        unitPriceMinor: sub.unitPriceMinor,
        discountBp: sub.discountBp,
        status: sub.status,
        activationDate: sub.activation,
        billingAnchor: sub.activation,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        nextBillingDate: sub.nextBillingDate,
        pauseRequestedAt: sub.pauseRequestedDaysAgo != null ? ago(sub.pauseRequestedDaysAgo) : null,
        pauseEffectiveAt: sub.pauseEffectiveAt,
        resumeAt: sub.resumeInDays == null ? null : ahead(sub.resumeInDays),
        cancelledAt: sub.cancelledAt,
        cancelEffectiveAt: sub.cancelEffectiveAt,
        entitlementsSnapshot: j(snapshot),
      },
    });
  }

  // ── invoices ───────────────────────────────────────────────────────
  const invoiceIds = new Map<string, string>();
  const invoiceMeta = new Map<string, { subtotal: number; tax: number; total: number }>();
  let invNumber = 9501;

  async function createInvoice(spec: {
    key: string;
    customer: string;
    orderKey?: string;
    shipmentKey?: string;
    type: "ONE_TIME" | "SERVICE" | "RECURRING" | "PRORATION";
    status: "DRAFT" | "ISSUED" | "VOID";
    issuedDaysAgo: number;
    sourceKey: string;
    lines: {
      description: string;
      qty: number;
      unitPriceMinor: number;
      taxBp: number;
      amountOverride?: number;
      orderLineKey?: string;
      subscriptionKey?: string;
      periodStart?: Date;
      periodEnd?: Date;
    }[];
  }) {
    const id = `sd_inv_${spec.key}`;
    const number = `INV-${pad(invNumber++)}`;
    invoiceIds.set(spec.key, id);
    const subtotal = spec.lines.reduce(
      (s, l) => s + (l.amountOverride ?? l.qty * l.unitPriceMinor),
      0,
    );
    const tax = spec.lines.reduce(
      (s, l) => s + pctOf(l.amountOverride ?? l.qty * l.unitPriceMinor, l.taxBp),
      0,
    );
    invoiceMeta.set(spec.key, { subtotal, tax, total: subtotal + tax });
    const issuedAt = ago(spec.issuedDaysAgo);
    await prisma.invoice.create({
      data: {
        id,
        number,
        customerId: cat.customers[spec.customer].id,
        orderId: spec.orderKey ? `sd_${spec.orderKey}` : null,
        shipmentId: spec.shipmentKey ? `sd_${spec.orderKey}_shp_${spec.shipmentKey}` : null,
        type: spec.type,
        status: spec.status,
        currency: "INR",
        issuedAt,
        dueAt: new Date(issuedAt.getTime() + 14 * DAY),
        subtotalMinor: subtotal,
        taxMinor: tax,
        totalMinor: subtotal + tax,
        paidMinor: 0,
        creditAppliedMinor: 0,
        sourceKey: spec.sourceKey,
        lines: {
          create: spec.lines.map((l, i) => {
            const amount = l.amountOverride ?? l.qty * l.unitPriceMinor;
            return {
              id: `${id}_l${i}`,
              description: l.description,
              qty: l.qty,
              unitPriceMinor: l.amountOverride != null ? Math.round(amount / l.qty) : l.unitPriceMinor,
              amountMinor: amount,
              taxMinor: pctOf(amount, l.taxBp),
              orderLineId: l.orderLineKey ? `sd_${spec.orderKey}_ol_${l.orderLineKey}` : null,
              subscriptionId: l.subscriptionKey ? subIds.get(l.subscriptionKey)! : null,
              periodStart: l.periodStart ?? null,
              periodEnd: l.periodEnd ?? null,
            };
          }),
        },
      },
    });
  }

  const shipmentLine = (qKey: string, lineKey: string, qty: number) => {
    const q = quotes.get(qKey)!;
    const line = q.final.lines.find((l) => lineKeyOf(l.id) === lineKey)!;
    return {
      description: `${cat.products[skuOf(cat, line.productId)].name} (${qty} of ${line.qty})`,
      qty,
      unitPriceMinor: partOf(line.netMinor, qty, line.qty),
      taxBp: line.taxBp,
      orderLineKey: lineKey,
    };
  };
  const serviceLine = (qKey: string, lineKey: string) => {
    const q = quotes.get(qKey)!;
    const line = q.final.lines.find((l) => lineKeyOf(l.id) === lineKey)!;
    return {
      description: `${cat.products[skuOf(cat, line.productId)].name} — completion`,
      qty: line.qty,
      unitPriceMinor: line.netMinor,
      taxBp: line.taxBp,
      orderLineKey: lineKey,
    };
  };
  const recurringLine = (sub: ResolvedSub, periodIndex: number, planName: string) => {
    const start = sub.periodStart(periodIndex);
    const end = periodEnd(sub.interval, start, sub.activation.getUTCDate());
    return {
      description: `${cat.products[sub.sku].name} · ${planName}`,
      qty: sub.qty,
      unitPriceMinor: sub.unitPriceMinor,
      taxBp: sub.taxBp,
      amountOverride: periodAmount(sub.qty, sub.unitPriceMinor, sub.discountBp),
      subscriptionKey: sub.key,
      periodStart: start,
      periodEnd: end,
      _sourceStart: start,
    };
  };

  // ONE_TIME + SERVICE + DRAFT edges
  await createInvoice({
    key: "i01",
    customer: "Mehta Logistics",
    orderKey: "o04",
    shipmentKey: "mum",
    type: "ONE_TIME",
    status: "ISSUED",
    issuedDaysAgo: 6,
    sourceKey: "SHIPMENT:sd_o04_shp_mum",
    lines: [shipmentLine("q14", "lap", 3), shipmentLine("q14", "mouse", 4), shipmentLine("q14", "cbl", 3)],
  });
  await createInvoice({
    key: "i02",
    customer: "Reddy Systems",
    orderKey: "o05",
    shipmentKey: "mum",
    type: "ONE_TIME",
    status: "ISSUED",
    issuedDaysAgo: 20,
    sourceKey: "SHIPMENT:sd_o05_shp_mum",
    lines: [shipmentLine("q15", "lap", 2), shipmentLine("q15", "cbl", 8)],
  });
  await createInvoice({
    key: "i03",
    customer: "Sharma Industries",
    orderKey: "o02",
    shipmentKey: "mum",
    type: "ONE_TIME",
    status: "DRAFT", // drafted before dispatch — never issued
    issuedDaysAgo: 1,
    sourceKey: "SHIPMENT:sd_o02_shp_mum",
    lines: [shipmentLine("q12", "lap", 2)],
  });
  await createInvoice({
    key: "i04",
    customer: "Reddy Systems",
    orderKey: "o05",
    type: "SERVICE",
    status: "ISSUED",
    issuedDaysAgo: 18,
    sourceKey: "COMPLETION:sd_o05_sc_svc",
    lines: [serviceLine("q15", "svc")],
  });
  await createInvoice({
    key: "i05",
    customer: "Sharma Industries",
    orderKey: "o06",
    type: "SERVICE",
    status: "ISSUED",
    issuedDaysAgo: 95,
    sourceKey: "COMPLETION:sd_o06_sc_warranty",
    lines: [serviceLine("q16", "warranty")],
  });
  await createInvoice({
    key: "i06",
    customer: "Sharma Industries",
    orderKey: "o06",
    shipmentKey: "mum",
    type: "ONE_TIME",
    status: "ISSUED",
    issuedDaysAgo: 96,
    sourceKey: "SHIPMENT:sd_o06_shp_mum",
    lines: [shipmentLine("q16", "lap", 1)],
  });

  // RECURRING invoices: every started period of every billing subscription.
  const recurringInvoices: Record<string, string[]> = {
    s2: ["i07", "i08", "i09"],
    s3: ["i10", "i11"],
    s4: ["i12"],
    s5: ["i13"],
    s6: ["i14", "i15", "i16"],
    s7: ["i17"],
    s8: ["i18"],
  };
  const planNameOf = (sub: ResolvedSub) => {
    const plan = sub.tier ? plans.get(`${sub.sku}:${sub.tier}:${sub.interval}`) : null;
    return plan?.name ?? `${sub.sku} plan`;
  };
  const customerOfSub = (sub: ResolvedSub) => quotes.get(quoteOfOrder(sub.orderKey))!.spec.customer;
  const recurringIssuedDaysAgo = new Map<string, number[]>();
  for (const sub of subs) {
    const keys = recurringInvoices[sub.key] ?? [];
    const issuedDays: number[] = [];
    for (const [periodIndex, key] of keys.entries()) {
      const start = sub.periodStart(periodIndex);
      issuedDays.push(Math.round((NOW - start.getTime()) / DAY));
      await createInvoice({
        key,
        customer: customerOfSub(sub),
        orderKey: sub.orderKey,
        type: "RECURRING",
        status: "ISSUED",
        issuedDaysAgo: Math.max(0, Math.round((NOW - start.getTime()) / DAY)),
        sourceKey: `SUB:${sub.id}:${start.toISOString()}`,
        lines: [recurringLine(sub, periodIndex, planNameOf(sub))],
      });
    }
    recurringIssuedDaysAgo.set(sub.key, issuedDays);
  }

  // PRORATION: s4's 20 → 50 upgrade (issued, paid) + voided duplicate;
  // s2's Pro → Plus upgrade (issued, paid).
  const s4 = subs.find((s) => s.key === "s4")!;
  const s4Delta = periodAmount(30, s4.unitPriceMinor, 0); // 20 → 50 units
  const s4Charge = prorate(s4Delta, { start: s4.activation, end: s4.boundaries[0] }, ago(60));
  const s4ChangeUuid = uuid();
  const s2 = subs.find((s) => s.key === "s2")!;
  const s2P2 = { start: s2.periodStart(1), end: s2.boundaries[1] };
  const s2Delta = periodAmount(25, photoPlan("Plus", "MONTHLY").plan.priceMinor, 0) -
    periodAmount(25, photoPlan("Pro", "MONTHLY").plan.priceMinor, 0);
  const s2Charge = prorate(s2Delta, s2P2, ago(40));
  const s2ChangeUuid = uuid();
  await createInvoice({
    key: "i19",
    customer: customerOfSub(s4),
    orderKey: s4.orderKey,
    type: "PRORATION",
    status: "ISSUED",
    issuedDaysAgo: 60,
    sourceKey: `PRORATION:${s4ChangeUuid}`,
    lines: [
      {
        description: "Subscription change",
        qty: 1,
        unitPriceMinor: s4Charge,
        taxBp: s4.taxBp,
        amountOverride: s4Charge,
        subscriptionKey: "s4",
        periodStart: ago(60),
        periodEnd: s4.boundaries[0],
      },
    ],
  });
  await createInvoice({
    key: "i20",
    customer: customerOfSub(s4),
    orderKey: s4.orderKey,
    type: "PRORATION",
    status: "VOID", // duplicate run voided by finance
    issuedDaysAgo: 60,
    sourceKey: `PRORATION:${uuid()}`,
    lines: [
      {
        description: "Subscription change",
        qty: 1,
        unitPriceMinor: s4Charge,
        taxBp: s4.taxBp,
        amountOverride: s4Charge,
        subscriptionKey: "s4",
        periodStart: ago(60),
        periodEnd: s4.boundaries[0],
      },
    ],
  });
  await createInvoice({
    key: "i21",
    customer: customerOfSub(s2),
    orderKey: s2.orderKey,
    type: "PRORATION",
    status: "ISSUED",
    issuedDaysAgo: 40,
    sourceKey: `PRORATION:${s2ChangeUuid}`,
    lines: [
      {
        description: "Subscription change",
        qty: 1,
        unitPriceMinor: s2Charge,
        taxBp: s2.taxBp,
        amountOverride: s2Charge,
        subscriptionKey: "s2",
        periodStart: ago(40),
        periodEnd: s2P2.end,
      },
    ],
  });

  // ── payments ───────────────────────────────────────────────────────
  const paymentSpecs: [string, "BANK_TRANSFER" | "CARD" | "CASH" | "OTHER", number | "FULL", string | null][] = [
    ["i01", "CARD", Math.round(invoiceMeta.get("i01")!.total * 0.4), "HDFC PG 889102"],
    ["i01", "CASH", Math.round(invoiceMeta.get("i01")!.total * 0.3), null], // reference-null edge
    ["i02", "BANK_TRANSFER", "FULL", "NEFT N092381"],
    ["i05", "BANK_TRANSFER", "FULL", "RTGS R771201"],
    ["i06", "CARD", "FULL", "ICICI PG 441023"],
    ["i07", "BANK_TRANSFER", "FULL", "NEFT N118902"],
    ["i08", "BANK_TRANSFER", "FULL", "NEFT N126014"],
    // i09 deliberately has no payment: CN-09501 (credit) settles part of it,
    // and derivePaymentStatus rejects paid+credit exceeding the total.
    ["i12", "BANK_TRANSFER", "FULL", "NEFT N204417"],
    ["i13", "CASH", "FULL", null],
    ["i17", "BANK_TRANSFER", "FULL", "NEFT N310222"],
    ["i19", "OTHER", "FULL", "UPI 4291xxx887"],
    ["i21", "CARD", "FULL", "ICICI PG 441099"],
  ];
  for (const [key, method, amount, reference] of paymentSpecs) {
    const total = invoiceMeta.get(key)!.total;
    await prisma.payment.create({
      data: {
        id: `sd_pay_${key}_${method}`.toLowerCase(),
        invoiceId: invoiceIds.get(key)!,
        amountMinor: amount === "FULL" ? total : amount,
        method,
        reference,
        paidAt: ago(2),
        recordedById: users.priya,
        idempotencyKey: uuid(),
      },
    });
    await prisma.invoice.update({
      where: { id: invoiceIds.get(key)! },
      data: { paidMinor: { increment: amount === "FULL" ? total : amount } },
    });
  }

  // ── credit notes & applications ────────────────────────────────────
  // CN1: goodwill credit fully applied to s2's current (unpaid) invoice.
  const cn1Amount = 150_000;
  // CN4: credit from s4's 50 → 30 downgrade against an already-paid invoice
  // → the whole credit becomes refund-due.
  const s4Credit = prorate(
    periodAmount(20, s4.unitPriceMinor, 0),
    { start: s4.activation, end: s4.boundaries[0] },
    ago(30),
  );
  const s4CreditUuid = uuid();
  // CN2: immediate-cancellation refund on s7's paid invoice.
  const cn2Amount = periodAmount(4, careStandard("YEARLY").plan.priceMinor, 0);
  await prisma.creditNote.createMany({
    data: [
      {
        id: "sd_cn1",
        number: "CN-09501",
        customerId: cat.customers["Sharma Industries"].id,
        currency: "INR",
        subscriptionId: subIds.get("s2")!,
        sourceInvoiceId: invoiceIds.get("i09")!,
        amountMinor: cn1Amount,
        remainingMinor: 0, // fully applied
        refundDueMinor: 0,
        reason: "Goodwill adjustment — service downtime credit",
        idempotencyKey: `CREDIT:${uuid()}`,
        createdById: users.priya,
        createdAt: ago(10),
      },
      {
        id: "sd_cn2",
        number: "CN-09502",
        customerId: cat.customers["Chettiar Freight"].id,
        currency: "INR",
        subscriptionId: subIds.get("s7")!,
        sourceInvoiceId: invoiceIds.get("i17")!,
        amountMinor: cn2Amount,
        remainingMinor: 0,
        refundDueMinor: cn2Amount, // invoice already paid → refund owed
        reason: "Duplicate order — cancelled immediately",
        idempotencyKey: `CANCEL:${uuid()}:${invoiceIds.get("i17")}`,
        createdById: users.priya,
        createdAt: ago(29),
      },
      {
        id: "sd_cn3",
        number: "CN-09503",
        customerId: cat.customers["Sharma Industries"].id,
        currency: "INR",
        subscriptionId: subIds.get("s4")!,
        sourceInvoiceId: invoiceIds.get("i12")!,
        amountMinor: 120_000,
        remainingMinor: 120_000, // never applied — idle balance edge
        refundDueMinor: 0,
        reason: "Prorated subscription change",
        idempotencyKey: `CREDIT:${uuid()}`,
        createdById: users.priya,
        createdAt: ago(15),
      },
      {
        id: "sd_cn4",
        number: "CN-09504",
        customerId: cat.customers["Sharma Industries"].id,
        currency: "INR",
        subscriptionId: subIds.get("s4")!,
        sourceInvoiceId: invoiceIds.get("i12")!,
        amountMinor: s4Credit,
        remainingMinor: 0,
        refundDueMinor: s4Credit, // paid in cash earlier → refund owed
        reason: "Prorated subscription change",
        idempotencyKey: `CREDIT:${s4CreditUuid}`,
        createdById: users.priya,
        createdAt: ago(30),
      },
    ],
  });
  await prisma.creditApplication.create({
    data: {
      id: "sd_ca1",
      creditNoteId: "sd_cn1",
      invoiceId: invoiceIds.get("i09")!,
      amountMinor: cn1Amount,
      appliedAt: ago(10),
    },
  });
  await prisma.invoice.update({
    where: { id: invoiceIds.get("i09")! },
    data: { creditAppliedMinor: cn1Amount },
  });

  // ── billing schedules ──────────────────────────────────────────────
  const scheduleInvoiced: Record<string, { periodIndex: number; invoiceId: string }[]> = {
    s2: [
      { periodIndex: 0, invoiceId: invoiceIds.get("i07")! },
      { periodIndex: 1, invoiceId: invoiceIds.get("i08")! },
      { periodIndex: 2, invoiceId: invoiceIds.get("i09")! },
    ],
    s3: [
      { periodIndex: 0, invoiceId: invoiceIds.get("i10")! },
      { periodIndex: 1, invoiceId: invoiceIds.get("i11")! },
    ],
    s4: [{ periodIndex: 0, invoiceId: invoiceIds.get("i12")! }],
    s5: [{ periodIndex: 0, invoiceId: invoiceIds.get("i13")! }],
    s6: [
      { periodIndex: 0, invoiceId: invoiceIds.get("i14")! },
      { periodIndex: 1, invoiceId: invoiceIds.get("i15")! },
      { periodIndex: 2, invoiceId: invoiceIds.get("i16")! },
    ],
    s7: [{ periodIndex: 0, invoiceId: invoiceIds.get("i17")! }],
    s8: [{ periodIndex: 0, invoiceId: invoiceIds.get("i18")! }],
  };
  let schedCount = 0;
  for (const sub of subs) {
    const rows = buildSchedule(sub, scheduleInvoiced[sub.key] ?? []);
    for (const [i, row] of rows.entries()) {
      schedCount++;
      await prisma.billingScheduleItem.create({
        data: {
          id: `sd_sched_${sub.key}_${i}`,
          subscriptionId: sub.id,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          amountMinor: row.amountMinor,
          status: row.status,
          invoiceId: row.invoiceId,
          entitlements: j(
            sub.tier ? entitlementSnapshot(sub.sku, sub.tier, sub.interval) : {},
          ),
        },
      });
    }
  }

  // ── subscription transitions (all 12 types) ────────────────────────
  const transitions: {
    sub: string;
    type: string;
    daysAgo: number;
    actorId?: string;
    actorType: "SYSTEM" | "USER" | "CUSTOMER";
    detail?: unknown;
    idempotencyKey?: string;
  }[] = [
    { sub: "s2", type: "ACTIVATE", daysAgo: 75, actorType: "SYSTEM", idempotencyKey: `sd_sub_s2:ACTIVATE` },
    { sub: "s2", type: "PAUSE_REQUESTED", daysAgo: 70, actorId: users.aarav, actorType: "CUSTOMER", detail: {}, idempotencyKey: uuid() },
    { sub: "s2", type: "RESUME_SELECTED", daysAgo: 46, actorId: users.aarav, actorType: "CUSTOMER", detail: { adjusted: false }, idempotencyKey: uuid() },
    { sub: "s2", type: "PAUSED", daysAgo: 45, actorType: "SYSTEM", idempotencyKey: `sd_sub_s2:PAUSED:${s2.periodStart(1).toISOString()}` },
    { sub: "s2", type: "RESUMED", daysAgo: 45, actorType: "SYSTEM", idempotencyKey: `sd_sub_s2:RESUMED:${s2.periodStart(1).toISOString()}` },
    { sub: "s2", type: "RESUME_CHANGED", daysAgo: 44, actorId: users.aarav, actorType: "CUSTOMER", detail: { adjusted: false }, idempotencyKey: uuid() },
    { sub: "s2", type: "PERIOD_ADVANCED", daysAgo: Math.round((NOW - s2.periodStart(1).getTime()) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s2:PERIOD:${s2.periodStart(1).toISOString()}` },
    {
      sub: "s2",
      type: "PLAN_CHANGED",
      daysAgo: 40,
      actorId: users.vikram,
      actorType: "USER",
      detail: {
        creditMinor: 0,
        chargeMinor: s2Charge,
        creditTaxMinor: 0,
        chargeTaxMinor: pctOf(s2Charge, s2.taxBp),
        differentCycle: false,
        newQty: 25,
        newPlanId: photoPlan("Plus", "MONTHLY").plan.id,
        newPriceMinor: photoPlan("Plus", "MONTHLY").plan.priceMinor,
        effectiveAt: ago(40).toISOString(),
        pending: false,
      },
      idempotencyKey: s2ChangeUuid,
    },
    { sub: "s2", type: "PERIOD_ADVANCED", daysAgo: Math.round((NOW - s2.periodStart(2).getTime()) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s2:PERIOD:${s2.periodStart(2).toISOString()}` },
    { sub: "s3", type: "ACTIVATE", daysAgo: 45, actorType: "SYSTEM", idempotencyKey: `sd_sub_s3:ACTIVATE` },
    { sub: "s3", type: "PERIOD_ADVANCED", daysAgo: Math.round((NOW - s3Start().getTime()) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s3:PERIOD:${s3Start().toISOString()}` },
    { sub: "s4", type: "ACTIVATE", daysAgo: 200, actorType: "SYSTEM", idempotencyKey: `sd_sub_s4:ACTIVATE` },
    {
      sub: "s4",
      type: "QTY_CHANGED",
      daysAgo: 60,
      actorId: users.vikram,
      actorType: "USER",
      detail: {
        creditMinor: 0,
        chargeMinor: s4Charge,
        creditTaxMinor: 0,
        chargeTaxMinor: pctOf(s4Charge, s4.taxBp),
        differentCycle: false,
        newQty: 50,
        newPlanId: photoPlan("Pro", "YEARLY").plan.id,
        newPriceMinor: s4.unitPriceMinor,
        effectiveAt: ago(60).toISOString(),
        pending: false,
      },
      idempotencyKey: s4ChangeUuid,
    },
    {
      sub: "s4",
      type: "QTY_CHANGED",
      daysAgo: 30,
      actorId: users.priya,
      actorType: "USER",
      detail: {
        creditMinor: s4Credit,
        chargeMinor: 0,
        creditTaxMinor: pctOf(s4Credit, s4.taxBp),
        chargeTaxMinor: 0,
        differentCycle: false,
        newQty: 30,
        newPlanId: photoPlan("Pro", "YEARLY").plan.id,
        newPriceMinor: s4.unitPriceMinor,
        effectiveAt: ago(30).toISOString(),
        pending: false,
      },
      idempotencyKey: s4CreditUuid,
    },
    { sub: "s5", type: "PAUSE_REQUESTED", daysAgo: 35, actorId: users.aarav, actorType: "CUSTOMER", detail: {}, idempotencyKey: uuid() },
    { sub: "s5", type: "PAUSED", daysAgo: Math.round((NOW - (subs.find((s) => s.key === "s5")!.pauseEffectiveAt?.getTime() ?? NOW)) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s5:PAUSED:${subs.find((s) => s.key === "s5")!.pauseEffectiveAt?.toISOString()}` },
    { sub: "s5", type: "RESUME_SELECTED", daysAgo: 25, actorId: users.aarav, actorType: "CUSTOMER", detail: { adjusted: false }, idempotencyKey: uuid() },
    { sub: "s5", type: "RESUME_CHANGED", daysAgo: 20, actorId: users.deepa, actorType: "CUSTOMER", detail: { adjusted: true }, idempotencyKey: uuid() },
    { sub: "s6", type: "ACTIVATE", daysAgo: 80, actorType: "SYSTEM", idempotencyKey: `sd_sub_s6:ACTIVATE` },
    { sub: "s6", type: "PERIOD_ADVANCED", daysAgo: Math.round((NOW - subs.find((s) => s.key === "s6")!.periodStart(1).getTime()) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s6:PERIOD:${subs.find((s) => s.key === "s6")!.periodStart(1).toISOString()}` },
    { sub: "s6", type: "PERIOD_ADVANCED", daysAgo: Math.round((NOW - subs.find((s) => s.key === "s6")!.periodStart(2).getTime()) / DAY), actorType: "SYSTEM", idempotencyKey: `sd_sub_s6:PERIOD:${subs.find((s) => s.key === "s6")!.periodStart(2).toISOString()}` },
    {
      sub: "s6",
      type: "CANCEL_REQUESTED",
      daysAgo: 3,
      actorId: users.ananya,
      actorType: "CUSTOMER",
      detail: { mode: "END_OF_PERIOD", reason: "Budget cuts next quarter." },
      idempotencyKey: uuid(),
    },
    { sub: "s7", type: "ACTIVATE", daysAgo: 400, actorType: "SYSTEM", idempotencyKey: `sd_sub_s7:ACTIVATE` },
    {
      sub: "s7",
      type: "CANCEL_REQUESTED",
      daysAgo: 31,
      actorId: users.vikram,
      actorType: "USER",
      detail: { mode: "IMMEDIATE", reason: "Duplicate order" },
      idempotencyKey: uuid(),
    },
    { sub: "s7", type: "CANCELLED", daysAgo: 30, actorType: "SYSTEM", idempotencyKey: `sd_sub_s7:CANCELLED:${ago(30).toISOString()}` },
    { sub: "s8", type: "ACTIVATE", daysAgo: 25, actorType: "SYSTEM", idempotencyKey: `sd_sub_s8:ACTIVATE` },
    { sub: "s8", type: "PAUSE_REQUESTED", daysAgo: 9, actorId: users.ananya, actorType: "CUSTOMER", detail: {}, idempotencyKey: uuid() },
    { sub: "s8", type: "PAUSE_WITHDRAWN", daysAgo: 7, actorId: users.ananya, actorType: "CUSTOMER", detail: {}, idempotencyKey: uuid() },
    { sub: "s8", type: "PAUSE_REQUESTED", daysAgo: 2, actorId: users.ananya, actorType: "CUSTOMER", detail: {}, idempotencyKey: uuid() },
  ];
  function s3Start(): Date {
    return subs.find((s) => s.key === "s3")!.periodStart(1);
  }
  for (const t of transitions) {
    await prisma.subscriptionTransition.create({
      data: {
        id: `sd_tr_${t.sub}_${t.type}_${t.daysAgo}`,
        subscriptionId: subIds.get(t.sub)!,
        type: t.type as never,
        effectiveAt: ago(t.daysAgo),
        actorId: t.actorId ?? null,
        actorType: t.actorType,
        detail: t.detail === undefined ? Prisma.JsonNull : j(t.detail),
        idempotencyKey: t.idempotencyKey ?? null,
      },
    });
  }

  // ── deal-health alerts (all four types, all four statuses) ─────────
  await prisma.dealHealthAlert.createMany({
    data: [
      {
        id: "sd_alert_stalled",
        type: "STALLED",
        severity: "MEDIUM",
        quotationId: quotes.get("q22")!.id,
        detail: j({ lastActivityAt: ago(12).toISOString(), daysIdle: 12, thresholdDays: 7 }),
        status: "NUDGED",
        flaggedAt: ago(8),
        lastActionAt: ago(6),
        lastAction: "NUDGE_SENT",
      },
      {
        id: "sd_alert_anomaly",
        type: "DISCOUNT_ANOMALY",
        severity: "HIGH",
        quotationId: quotes.get("q23")!.id,
        detail: j({
          currentDiscountBp: 3200,
          averageDiscountBp: 900,
          deltaBp: 2300,
          minDeltaBp: 1000,
          samples: 6,
          lookbackDays: 90,
        }),
        status: "OPEN",
        flaggedAt: ago(1),
      },
      {
        id: "sd_alert_sla",
        type: "APPROVAL_SLA",
        severity: "MEDIUM",
        quotationId: quotes.get("q21")!.id,
        detail: j({
          approvalRequestId: "sd_apr_q21",
          stepRole: "FINANCE",
          dueAt: hoursAhead(-6).toISOString(),
          hoursOverdue: 6,
        }),
        status: "ESCALATED",
        flaggedAt: ago(1),
        lastActionAt: hoursAhead(-2),
        lastAction: "ESCALATED_TO_MANAGER",
      },
      {
        id: "sd_alert_slip",
        type: "DELIVERY_SLIPPAGE",
        severity: "LOW",
        quotationId: quotes.get("q24")!.id,
        orderId: "sd_o07",
        detail: j({
          promisedDeliveryDate: ago(2).toISOString(),
          estimatedShipDate: ahead(3).toISOString(),
          slipDays: 5,
          windowDays: 3,
        }),
        status: "RESOLVED",
        flaggedAt: ago(4),
        resolvedAt: ago(1),
        lastActionAt: ago(1),
        lastAction: "REPLENISHMENT_RECEIVED",
      },
    ],
  });

  // ── notifications ──────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { id: "sd_notif_1", userId: users.vikram, type: "APPROVAL_PENDING", title: "Review Q-09504", body: "Q-09504 v1 requires your review.", href: "/approvals/sd_apr_q04", readAt: null },
      { id: "sd_notif_2", userId: users.vikram, type: "APPROVAL_PENDING", title: "Review Q-09505", body: "Q-09505 v1 requires your review.", href: "/approvals/sd_apr_q05", readAt: ago(1) },
      { id: "sd_notif_3", userId: users.priya, type: "APPROVAL_PENDING", title: "Review Q-09521", body: "Q-09521 v1 requires your review.", href: "/approvals/sd_apr_q21", readAt: null },
      { id: "sd_notif_4", userId: users.rahul, type: "APPROVAL_DECISION", title: "Q-09506: approved", body: "SALES_MANAGER approved this step.", href: "/quotations/sd_q06", readAt: ago(2) },
      { id: "sd_notif_5", userId: users.rahul, type: "APPROVAL_DECISION", title: "Q-09510: declined", body: "Zero-margin bundle declined.", href: "/quotations/sd_q10", readAt: null },
      { id: "sd_notif_6", userId: users.rahul, type: "CUSTOMER_PROPOSAL", title: "Q-09508: customer request", body: "Aarav Sharma submitted 3 request(s).", href: "/quotations/sd_q08", readAt: null },
      { id: "sd_notif_7", userId: users.aarav, type: "QUOTATION_READY", title: "Q-09508 is ready to review", body: "Version 2 has been approved. Review the updated terms before accepting.", href: "/portal/quotations/sd_q08", readAt: null },
      { id: "sd_notif_8", userId: users.aarav, type: "PROPOSAL_RESPONSE", title: "Q-09508: proposal applied", body: "Review version 2 before accepting.", href: "/portal/quotations/sd_q08", readAt: ago(2) },
      { id: "sd_notif_9", userId: users.ananya, type: "QUOTATION_READY", title: "Q-09507 is ready to review", body: "Version 2 has been approved. Review the updated terms before accepting.", href: "/portal/quotations/sd_q07", readAt: ago(1) },
      { id: "sd_notif_10", userId: users.ananya, type: "PAUSED", title: "Subscription schedule updated", body: "pause requested effective upcoming billing boundary.", href: "/portal/subscriptions/sd_sub_s8", readAt: null },
      { id: "sd_notif_11", userId: users.aarav, type: "RESUMED", title: "Subscription schedule updated", body: "resumed effective at the last billing boundary.", href: "/portal/subscriptions/sd_sub_s2", readAt: ago(40) },
      { id: "sd_notif_12", userId: users.deepa, type: "CANCELLED", title: "Subscription schedule updated", body: "cancelled effective immediately.", href: "/portal/subscriptions/sd_sub_s7", readAt: null },
      { id: "sd_notif_13", userId: users.rohan, type: "ACCOUNT_APPROVED", title: "Your account is ready", body: "You now have CUSTOMER access.", href: "/dashboard", readAt: ago(20) },
    ],
  });

  // ── email outbox (all three statuses, all related types) ───────────
  await prisma.emailMessage.createMany({
    data: [
      {
        id: "sd_email_1",
        toEmail: "ananya.mehta@yopmail.com",
        toName: "Ananya Mehta",
        subject: "Review quotation Q-09507",
        textBody: "Your quotation Q-09507, version 2, is ready to review. Open your secure customer portal to accept.",
        htmlBody: "<p>Your quotation <strong>Q-09507</strong>, version 2, is ready to review.</p>",
        status: "SENT",
        relatedType: "Quotation",
        relatedId: quotes.get("q07")!.id,
        attempts: 1,
        sentAt: ago(2),
      },
      {
        id: "sd_email_2",
        toEmail: "rohan.gupta@yopmail.com",
        toName: "Rohan Gupta",
        subject: "Your DealFlow360 sign-in link",
        textBody: "Use the secure link below to sign in to your DealFlow360 customer portal. It expires in 15 minutes.",
        status: "SENT",
        relatedType: "USER",
        relatedId: users.rohan,
        attempts: 1,
        sentAt: ago(20),
      },
      {
        id: "sd_email_3",
        toEmail: "karthik.iyer@yopmail.com",
        toName: "Karthik Iyer",
        subject: "Your DealFlow360 sign-in link",
        textBody: "Use the secure link below to sign in to your DealFlow360 customer portal. It expires in 15 minutes.",
        status: "FAILED",
        relatedType: "USER",
        relatedId: users.rahul,
        error: "SMTP connection timeout after 30s",
        attempts: 3,
      },
      {
        id: "sd_email_4",
        toEmail: "vikram.manager@yopmail.com",
        toName: "Vikram Desai",
        subject: "Review Q-09504",
        textBody: "Q-09504 v1 requires your review.",
        status: "QUEUED",
        relatedType: "Notification",
        relatedId: "sd_notif_1",
        attempts: 0,
      },
      {
        id: "sd_email_5",
        toEmail: "aarav.sharma@yopmail.com",
        toName: "Aarav Sharma",
        subject: "Changes to your Photo App Plus plan from your next billing cycle",
        textBody: "Hello Aarav Sharma,\n\nStorage: now 500 GB instead of 200 GB (from your next billing cycle).",
        htmlBody: "<p>Hello Aarav Sharma,</p><ul><li>Storage: now 500 GB instead of 200 GB</li></ul>",
        status: "QUEUED",
        relatedType: "PlanChangeNotice",
        relatedId: "sd_notice_1",
        attempts: 0,
      },
    ],
  });

  // ── plan change notices ────────────────────────────────────────────
  await prisma.planChangeNotice.createMany({
    data: [
      {
        id: "sd_notice_1",
        productId: products["SUB-PHOTO"].id,
        tierId: tierIds.get("SUB-PHOTO:Plus")!,
        interval: "MONTHLY",
        changes: j([
          {
            tierId: tierIds.get("SUB-PHOTO:Plus"),
            interval: "MONTHLY",
            key: "storage",
            label: "Storage",
            unit: "GB",
            per: "MONTH",
            before: 200,
            after: 500,
          },
        ]),
        effectiveRule: "NEXT_CYCLE",
        publishedById: users.admin,
        publishedAt: ago(1),
        recipientCount: 1,
      },
      {
        id: "sd_notice_2",
        productId: products["SUB-CARE"].id,
        tierId: tierIds.get("SUB-CARE:Standard")!,
        interval: null, // all-intervals edge
        changes: j([
          {
            tierId: tierIds.get("SUB-CARE:Standard"),
            interval: null,
            key: "seats",
            label: "Seats",
            unit: "seats",
            per: "CYCLE",
            before: 5,
            after: 10,
          },
        ]),
        effectiveRule: "NEXT_CYCLE",
        publishedById: users.admin,
        publishedAt: ago(3),
        recipientCount: 0, // no active holders on this tier yet
      },
    ],
  });

  // ── warehouse activity ─────────────────────────────────────────────
  await prisma.stockMovement.createMany({
    data: [
      { id: "sd_move_1", warehouseId: warehouses.MAIN, productId: products["CBL-USBC"].id, qty: 200, type: "RECEIPT", refType: "PO", refId: "PO-2026-118", note: "Monthly replenishment", actorId: users.admin, createdAt: ago(25) },
      { id: "sd_move_2", warehouseId: warehouses.MAIN, productId: products["CBL-USBC"].id, qty: -200, type: "SHIP", refType: "Order", refId: "sd_o05", actorId: users.sneha, createdAt: ago(20) },
      { id: "sd_move_3", warehouseId: warehouses.MAIN, productId: products["LAP-PRO-14"].id, qty: 2, type: "RESERVE", refType: "Order", refId: "sd_o02", actorId: users.vikram, createdAt: ago(73) },
      { id: "sd_move_4", warehouseId: warehouses.MAIN, productId: products["LAP-PRO-14"].id, qty: -2, type: "RELEASE", refType: "Order", refId: "sd_o08", note: "Order cancelled", actorId: users.rahul, createdAt: ago(13) },
      { id: "sd_move_5", warehouseId: warehouses.MAIN, productId: products["KB-MECH"].id, qty: -1, type: "ADJUST", note: "Damaged in transit", actorId: users.admin, createdAt: ago(5) },
    ],
  });
  await prisma.replenishmentPlan.createMany({
    data: [
      { id: "sd_rep_1", warehouseId: warehouses.MAIN, productId: products["CBL-USBC"].id, qty: 300, eta: ahead(6), status: "PLANNED" },
      { id: "sd_rep_2", warehouseId: warehouses.MAIN, productId: products["KB-MECH"].id, qty: 20, eta: ago(10), status: "RECEIVED" },
      { id: "sd_rep_3", warehouseId: warehouses.EAST, productId: products["DOCK-STD"].id, qty: 12, eta: ago(2), status: "CANCELLED" },
    ],
  });

  // ── audit trail samples ────────────────────────────────────────────
  const audits: {
    id: string;
    actorId?: string | null;
    actorType: "USER" | "CUSTOMER" | "SYSTEM";
    entityType: string;
    entityId: string;
    action: string;
    version?: number;
    before?: unknown;
    after?: unknown;
    reason?: string;
    daysAgo: number;
  }[] = [
    { id: "sd_a1", actorId: users.rahul, actorType: "USER", entityType: "Quotation", entityId: "sd_q01", action: "QUOTATION.CREATED", version: 1, after: { number: "Q-09501" }, daysAgo: 3 },
    { id: "sd_a2", actorId: users.rahul, actorType: "USER", entityType: "QuotationLine", entityId: "sd_q01_ln_dock", action: "QUOTATION.LINE_ADDED", version: 2, after: { productId: products["DOCK-STD"].id, qty: 1 }, daysAgo: 2 },
    { id: "sd_a3", actorId: users.rahul, actorType: "USER", entityType: "Quotation", entityId: "sd_q04", action: "QUOTATION.UPDATED", version: 1, reason: "SUBMIT", after: { status: "PENDING_APPROVAL" }, daysAgo: 1 },
    { id: "sd_a4", actorId: users.sneha, actorType: "USER", entityType: "Quotation", entityId: "sd_q07", action: "QUOTATION.SENT", version: 2, after: { portalTokenSet: true }, daysAgo: 2 },
    { id: "sd_a5", actorId: users.aarav, actorType: "CUSTOMER", entityType: "Quotation", entityId: "sd_q08", action: "QUOTATION.PROPOSALS_SUBMITTED", version: 2, after: { messageIds: ["sd_msg_4", "sd_msg_7"] }, daysAgo: 1 },
    { id: "sd_a6", actorId: users.rahul, actorType: "USER", entityType: "Quotation", entityId: "sd_q08", action: "PROPOSAL.APPLY", version: 2, after: { messageId: "sd_msg_2", counterDiscountBp: 2000 }, daysAgo: 3 },
    { id: "sd_a7", actorId: users.rahul, actorType: "USER", entityType: "Quotation", entityId: "sd_q08", action: "PROPOSAL.DECLINE", after: { messageId: "sd_msg_6" }, daysAgo: 5 },
    { id: "sd_a8", actorId: users.aarav, actorType: "CUSTOMER", entityType: "Quotation", entityId: "sd_q08", action: "PROPOSAL.WITHDRAWN", after: { messageId: "sd_msg_1" }, daysAgo: 6 },
    { id: "sd_a9", actorId: users.deepa, actorType: "CUSTOMER", entityType: "Quotation", entityId: "sd_q11", action: "QUOTATION.ACCEPTED_BY_CUSTOMER", version: 1, after: { ip: "49.36.181.12" }, daysAgo: 1 },
    { id: "sd_a10", actorId: null, actorType: "SYSTEM", entityType: "Order", entityId: "sd_o01", action: "ORDER.CREATED", after: { quotationId: "sd_q11", number: "ORD-09501" }, daysAgo: 1 },
    { id: "sd_a11", actorId: users.vikram, actorType: "USER", entityType: "FulfillmentPlan", entityId: "sd_o01_plan", action: "FULFILLMENT.PROPOSED", after: { method: "EXHAUSTIVE" }, daysAgo: 1 },
    { id: "sd_a12", actorId: users.vikram, actorType: "USER", entityType: "FulfillmentPlan", entityId: "sd_o02_plan", action: "FULFILLMENT.ACCEPTED", after: { status: "ACCEPTED" }, daysAgo: 73 },
    { id: "sd_a13", actorId: users.vikram, actorType: "USER", entityType: "FulfillmentPlan", entityId: "sd_o07_plan", action: "FULFILLMENT.OVERRIDDEN", after: { method: "MANUAL" }, reason: "Customer requested single-site dispatch", daysAgo: 8 },
    { id: "sd_a14", actorId: users.rahul, actorType: "USER", entityType: "Shipment", entityId: "sd_o04_shp_mum", action: "SHIPMENT.DISPATCHED", after: { number: "SHP-09504" }, daysAgo: 6 },
    { id: "sd_a15", actorId: users.rahul, actorType: "USER", entityType: "ServiceCompletion", entityId: "sd_o05_sc_svc", action: "SERVICE.COMPLETED", after: { note: "Installed at Andheri site." }, daysAgo: 18 },
    { id: "sd_a16", actorId: users.vikram, actorType: "USER", entityType: "Backorder", entityId: "sd_o04_bo_cbl_ALLOCATED", action: "BACKORDER.CONSOLIDATED", after: { warehouseId: warehouses.MAIN, qty: 2, shipmentId: "sd_o04_shp_mum" }, daysAgo: 7 },
    { id: "sd_a17", actorId: null, actorType: "SYSTEM", entityType: "Invoice", entityId: "sd_inv_i01", action: "INVOICE.ISSUED", after: { number: "INV-09501", totalMinor: invoiceMeta.get("i01")!.total }, daysAgo: 6 },
    { id: "sd_a18", actorId: users.priya, actorType: "USER", entityType: "Payment", entityId: "sd_pay_i01_card", action: "PAYMENT.RECORDED", after: { amountMinor: Math.round(invoiceMeta.get("i01")!.total * 0.4), method: "CARD" }, daysAgo: 2 },
    { id: "sd_a19", actorId: users.priya, actorType: "USER", entityType: "Invoice", entityId: "sd_inv_i09", action: "INVOICE.PAYMENT_APPLIED", after: { creditAppliedMinor: cn1Amount }, daysAgo: 10 },
    { id: "sd_a20", actorId: users.priya, actorType: "USER", entityType: "CreditNote", entityId: "sd_cn1", action: "CREDIT.ISSUED", after: { amountMinor: cn1Amount, reason: "Goodwill adjustment — service downtime credit" }, daysAgo: 10 },
    { id: "sd_a21", actorId: users.priya, actorType: "USER", entityType: "CreditNote", entityId: "sd_cn1", action: "CREDIT.APPLIED", after: { invoiceId: "sd_inv_i09", amountMinor: cn1Amount }, daysAgo: 10 },
    { id: "sd_a22", actorId: null, actorType: "SYSTEM", entityType: "Subscription", entityId: "sd_sub_s1", action: "SUBSCRIPTION.SCHEDULED", after: { activationDate: ahead(10).toISOString() }, daysAgo: 1 },
    { id: "sd_a23", actorId: null, actorType: "SYSTEM", entityType: "Subscription", entityId: "sd_sub_s5", action: "SUBSCRIPTION.PAUSED", after: { pauseEffectiveAt: subs.find((s) => s.key === "s5")!.pauseEffectiveAt?.toISOString() }, daysAgo: Math.round((NOW - (subs.find((s) => s.key === "s5")!.pauseEffectiveAt?.getTime() ?? NOW)) / DAY) },
    { id: "sd_a24", actorId: null, actorType: "SYSTEM", entityType: "Subscription", entityId: "sd_sub_s7", action: "SUBSCRIPTION.CANCELLED", after: { mode: "IMMEDIATE" }, daysAgo: 30 },
    { id: "sd_a25", actorId: users.admin, actorType: "USER", entityType: "StockLevel", entityId: "sd_move_5", action: "STOCK.ADJUSTED", before: { onHand: 5, reserved: 2 }, after: { onHand: 4, reserved: 2 }, reason: "Damaged in transit", daysAgo: 5 },
    { id: "sd_a26", actorId: users.admin, actorType: "USER", entityType: "ReplenishmentPlan", entityId: "sd_rep_1", action: "REPLENISHMENT.CREATED", after: { qty: 300, eta: ahead(6).toISOString() }, daysAgo: 2 },
    { id: "sd_a27", actorId: users.admin, actorType: "USER", entityType: "User", entityId: users.rohan, action: "USER.ROLE_ASSIGNED", before: { role: "PENDING" }, after: { role: "CUSTOMER" }, daysAgo: 20 },
    { id: "sd_a28", actorId: users.admin, actorType: "USER", entityType: "Customer", entityId: cat.customers["Chettiar Freight"].id, action: "CUSTOMER.PRICE_LIST_ASSIGNED", after: { priceListId: Object.keys(lists).find((k) => lists[k]!.rule === "FIXED_ITEMS") }, daysAgo: 30 },
    { id: "sd_a29", actorId: null, actorType: "SYSTEM", entityType: "Quotation", entityId: "sd_q17", action: "QUOTATION.EXPIRED", version: 1, reason: "Valid-until passed", daysAgo: 15 },
    { id: "sd_a30", actorId: users.sneha, actorType: "USER", entityType: "Quotation", entityId: "sd_q18", action: "QUOTATION.CANCELLED", version: 1, reason: "Customer went with an in-house solution", daysAgo: 9 },
  ];
  for (const a of audits) {
    await prisma.auditLog.create({
      data: {
        id: a.id,
        actorId: a.actorId ?? null,
        actorType: a.actorType,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        version: a.version ?? null,
        before: a.before === undefined ? Prisma.JsonNull : j(a.before),
        after: a.after === undefined ? Prisma.JsonNull : j(a.after),
        reason: a.reason ?? null,
        createdAt: ago(a.daysAgo),
      },
    });
  }

  // ── portal magic-link tokens ───────────────────────────────────────
  await prisma.verificationToken.createMany({
    data: [
      { identifier: "aarav.sharma@yopmail.com", token: hex64(), expires: new Date(NOW + 10 * 60_000), expiresAtUnix: BigInt(NOW + 10 * 60_000), purpose: "PORTAL_LOGIN" },
      { identifier: "ananya.mehta@yopmail.com", token: hex64(), expires: ago(1), expiresAtUnix: BigInt(ago(1).getTime()), purpose: "PORTAL_LOGIN" }, // expired edge
    ],
  });

  // ── empty team edge ────────────────────────────────────────────────
  await prisma.team.create({ data: { id: "sd_team_partners", name: "Channel Partners" } });

  console.log(
    `  demo: ${quoteSpecs.length} quotations, 15 approval requests, 8 orders, ${subs.length} subscriptions, ${invoiceIds.size} invoices, ${schedCount} schedule items, 4 credit notes, 4 alerts, 13 notifications, 5 emails, ${audits.length} audit rows`,
  );
}
