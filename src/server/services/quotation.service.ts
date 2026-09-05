import { emit } from "@/server/events";
import { Prisma, type Quotation } from "@prisma/client";
import type { z } from "zod";
import { prisma, withTx, lockRow, type Tx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { nextNumber } from "@/server/sequences";
import type { SessionUser } from "@/server/auth/guards";
import {
  Conflict,
  Forbidden,
  NotEditable,
  NotFound,
  ValidationError,
} from "@/domain/errors";
import { resolveUnitPrice } from "@/domain/pricing/resolve-price";
import { termsHash } from "@/domain/quotation/terms-hash";
import { DEFAULT_CURRENCY } from "@/domain/money/money";
import {
  AddQuoteLineInput,
  CreateQuoteInput,
  EditQuoteInput,
  QuoteReasonInput,
} from "@/lib/zod-schemas/quotation";
import { getActivePolicy } from "./policy.service";
import { repriceQuotation } from "./quotation-pricing";

export const SALES_ROLES = ["SALES_REP", "SALES_MANAGER", "ADMIN"] as const;
export function assertQuoteAccess(
  q: Pick<Quotation, "ownerId">,
  actor: SessionUser,
) {
  if (!SALES_ROLES.includes(actor.role as (typeof SALES_ROLES)[number]))
    throw new Forbidden();
  if (
    actor.id !== q.ownerId &&
    !["SALES_MANAGER", "ADMIN"].includes(actor.role)
  )
    throw new Forbidden("This quotation belongs to another owner.");
}
export function assertEditable(q: Quotation, actor: SessionUser) {
  assertQuoteAccess(q, actor);
  if (!["DRAFT", "REVISION_REQUESTED"].includes(q.status))
    throw new NotEditable("Create a revision before changing these terms.");
}
export async function lockedQuote(
  tx: Tx,
  id: string,
  expectedVersion?: number,
) {
  await lockRow(tx, "Quotation", id);
  const q = await tx.quotation.findUnique({ where: { id } });
  if (!q) throw new NotFound("Quotation no longer exists.");
  if (expectedVersion !== undefined && q.version !== expectedVersion)
    throw new Conflict("This quote changed. Reload before saving.");
  return q;
}
export async function snapshotVersion(
  tx: Tx,
  id: string,
  actor: SessionUser,
  reason: string,
) {
  const q = await tx.quotation.findUniqueOrThrow({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  const snapshot = JSON.parse(JSON.stringify(q)) as Prisma.InputJsonValue;
  const hash = termsHash({
    customerId: q.customerId,
    orderDiscountBp: q.orderDiscountBp,
    validUntil: q.validUntil,
    requestedDeliveryDate: q.requestedDeliveryDate,
    customerNote: q.customerNote,
    lines: q.lines.map((l) => ({
      productId: l.productId,
      variantValueIds: [...l.variantValueIds].sort(),
      planId: l.planId,
      qty: l.qty,
      discountBp: l.discountBp,
      unitPriceMinor: l.unitPriceMinor,
      taxBp: l.taxBp,
      interval: l.interval,
    })),
  });
  return tx.quotationVersion.create({
    data: {
      quotationId: id,
      version: q.version,
      snapshot,
      termsHash: hash,
      policyVersionId: q.policyVersionId,
      riskMetrics: q.riskMetrics ?? Prisma.JsonNull,
      requiredLevel: q.requiredLevel,
      createdById: actor.id,
      createdByType: actor.role === "CUSTOMER" ? "CUSTOMER" : "USER",
      reason,
    },
  });
}
async function finishEdit(
  tx: Tx,
  q: Quotation,
  actor: SessionUser,
  reason: string,
) {
  await tx.quotation.update({
    where: { id: q.id },
    data: { version: { increment: 1 }, approvedVersion: null },
  });
  await repriceQuotation(tx, q.id);
  await snapshotVersion(tx, q.id, actor, reason);
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: "USER",
    entityType: "Quotation",
    entityId: q.id,
    action: "QUOTATION.UPDATED",
    version: q.version + 1,
    reason,
  });
  return { id: q.id, version: q.version + 1 };
}
/** Most recently quoted customer for this owner, else any active customer. */
async function defaultCustomerFor(tx: Tx, actor: SessionUser) {
  const recent = await tx.quotation.findFirst({
    where: { ownerId: actor.id, customer: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: { customer: { include: { priceList: true } } },
  });
  if (recent?.customer) return recent.customer;
  return tx.customer.findFirst({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { priceList: true },
  });
}

/**
 * Starts a draft in one click, with no customer chosen up front.
 *
 * This is a separate entry point rather than making `customerId` optional on
 * CreateQuoteInput: "create a quotation for this customer" should keep failing
 * loudly when the customer is missing. Here the omission is the whole point, so
 * the customer is resolved first and the normal create path runs unchanged.
 */
export async function startDraftQuotation(actor: SessionUser) {
  if (!SALES_ROLES.includes(actor.role as (typeof SALES_ROLES)[number]))
    throw new Forbidden();
  const customer = await defaultCustomerFor(prisma, actor);
  if (!customer)
    throw new ValidationError(
      "No active customer exists yet. Add a customer before quoting.",
    );
  return createQuotation(actor, { customerId: customer.id });
}

export async function createQuotation(
  actor: SessionUser,
  raw: z.infer<typeof CreateQuoteInput>,
) {
  if (!SALES_ROLES.includes(actor.role as (typeof SALES_ROLES)[number]))
    throw new Forbidden();
  const input = CreateQuoteInput.parse(raw);
  return withTx(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      include: { priceList: true },
    });
    if (!customer?.isActive)
      throw new ValidationError("Choose an active customer.");
    const portal = await getActivePolicy(tx, "PORTAL");
    const q = await tx.quotation.create({
      data: {
        number: await nextNumber(tx, "Q"),
        customerId: customer.id,
        ownerId: actor.id,
        priceListId: customer.priceListId,
        currency: customer.priceList?.currency ?? customer.currency ?? DEFAULT_CURRENCY,
        validUntil:
          input.validUntil ??
          new Date(Date.now() + portal.payload.quoteValidityDays * 86400000),
      },
    });
    await repriceQuotation(tx, q.id);
    await snapshotVersion(tx, q.id, actor, "Quotation created");
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Quotation",
      entityId: q.id,
      action: "QUOTATION.CREATED",
      version: 1,
    });
    return { id: q.id, version: q.version };
  });
}
async function catalogueSnapshot(
  tx: Tx,
  q: Quotation,
  input: Pick<
    z.infer<typeof AddQuoteLineInput>,
    "productId" | "planId" | "variantValueIds"
  >,
) {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    include: { attributes: { include: { values: true } } },
  });
  if (!product || product.status !== "ACTIVE")
    throw new ValidationError("Choose an active product.");
  const ids = input.variantValueIds;
  const values = product.attributes.flatMap((a) =>
    a.values
      .filter((v) => ids.includes(v.id))
      .map((v) => ({ ...v, attributeName: a.name })),
  );
  if (
    new Set(ids).size !== ids.length ||
    values.length !== ids.length ||
    new Set(values.map((v) => v.attributeId)).size !== values.length
  )
    throw new ValidationError(
      "Choose at most one value per product attribute.",
    );
  const plan = input.planId
    ? await tx.subscriptionPlan.findUnique({
        where: { id: input.planId },
        include: { tier: true },
      })
    : null;
  if (
    product.type === "SUBSCRIPTION" &&
    (!plan ||
      !plan.isActive ||
      plan.productId !== product.id ||
      plan.tier?.isActive === false)
  )
    throw new ValidationError(
      "Choose an active subscription plan for this product.",
    );
  if (product.type !== "SUBSCRIPTION" && plan)
    throw new ValidationError("Only subscriptions have billing plans.");
  const priceList = q.priceListId
    ? await tx.priceList.findUnique({
        where: { id: q.priceListId },
        include: { items: true },
      })
    : null;
  if (priceList && !priceList.isActive)
    throw new ValidationError(
      "The price list is inactive. Select a current customer price list.",
    );
  return {
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId,
    variantValueIds: ids,
    variantLabel:
      values.map((v) => `${v.attributeName}: ${v.value}`).join(" · ") || null,
    planId: plan?.id ?? null,
    interval: plan?.interval ?? null,
    unitPriceMinor: plan
      ? plan.priceMinor + values.reduce((s, v) => s + v.extraPriceMinor, 0)
      : resolveUnitPrice(
          product,
          values.map((v) => v.extraPriceMinor),
          priceList,
        ),
    costPriceMinor: product.costPriceMinor,
    taxBp: product.taxBp,
  };
}
export async function addLine(
  actor: SessionUser,
  raw: z.infer<typeof AddQuoteLineInput>,
) {
  const input = AddQuoteLineInput.parse(raw);
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, input.id, input.expectedVersion);
    assertEditable(q, actor);
    const count = await tx.quotationLine.count({
      where: { quotationId: q.id },
    });
    if (count >= 500)
      throw new ValidationError("A quotation supports up to 500 lines.");
    const snapshot = await catalogueSnapshot(tx, q, input);
    const line = await tx.quotationLine.create({
      data: {
        ...snapshot,
        quotationId: q.id,
        qty: input.qty,
        discountBp: input.discountBp,
        sortOrder: count,
        addedFromUpsell: input.addedFromUpsell,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "QuotationLine",
      entityId: line.id,
      action: "QUOTATION.LINE_ADDED",
      after: JSON.parse(JSON.stringify(line)),
    });
    return finishEdit(tx, q, actor, "Line added");
  });
}
export async function updateQuotation(
  actor: SessionUser,
  raw: z.infer<typeof EditQuoteInput>,
) {
  const input = EditQuoteInput.parse(raw);
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, input.id, input.expectedVersion);
    assertEditable(q, actor);
    const lines = await tx.quotationLine.findMany({
      where: { quotationId: q.id },
    });
    if (
      input.lines.length !== lines.length ||
      new Set(input.lines.map((l) => l.id)).size !== lines.length ||
      input.lines.some((l) => !lines.some((old) => old.id === l.id))
    )
      throw new Conflict("Line items changed. Reload before saving.");
    for (const l of input.lines) {
      const old = lines.find((x) => x.id === l.id)!;
      if (old.qty === l.qty && old.discountBp === l.discountBp) continue;
      await tx.quotationLine.update({
        where: { id: l.id },
        data: { qty: l.qty, discountBp: l.discountBp },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        actorType: "USER",
        entityType: "QuotationLine",
        entityId: l.id,
        action: "QUOTATION.LINE_UPDATED",
        before: { qty: old.qty, discountBp: old.discountBp },
        after: { qty: l.qty, discountBp: l.discountBp },
      });
    }
    await tx.quotation.update({
      where: { id: q.id },
      data: {
        orderDiscountBp: input.orderDiscountBp,
        customerNote: input.customerNote,
        requestedDeliveryDate: input.requestedDeliveryDate,
        validUntil: input.validUntil,
      },
    });
    return finishEdit(tx, q, actor, "Quotation terms updated");
  });
}
export async function removeLine(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
  lineId: string,
) {
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, id, expectedVersion);
    assertEditable(q, actor);
    const line = await tx.quotationLine.findFirst({
      where: { id: lineId, quotationId: id },
    });
    if (!line) throw new NotFound("Line no longer exists.");
    await tx.quotationLine.update({
      where: { id: lineId },
      data: { deletedAt: new Date() },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "QuotationLine",
      entityId: lineId,
      action: "QUOTATION.LINE_REMOVED",
      before: JSON.parse(JSON.stringify(line)),
    });
    return finishEdit(tx, q, actor, "Line removed");
  });
}
export async function repriceFromCatalogue(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
) {
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, id, expectedVersion);
    assertEditable(q, actor);
    const lines = await tx.quotationLine.findMany({
      where: { quotationId: id },
    });
    for (const line of lines) {
      const data = await catalogueSnapshot(tx, q, {
        ...line,
        planId: line.planId ?? undefined,
      });
      await tx.quotationLine.update({ where: { id: line.id }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        actorType: "USER",
        entityType: "QuotationLine",
        entityId: line.id,
        action: "QUOTATION.LINE_REPRICED",
        before: {
          unitPriceMinor: line.unitPriceMinor,
          costPriceMinor: line.costPriceMinor,
        },
        after: data,
      });
    }
    return finishEdit(tx, q, actor, "Repriced from current catalogue");
  });
}
export async function reviseInTx(
  tx: Tx,
  actor: SessionUser,
  q: Quotation,
  reason: string,
) {
  assertQuoteAccess(q, actor);
  if (
    ![
      "APPROVED",
      "SENT",
      "UNDER_NEGOTIATION",
      "PENDING_APPROVAL",
      "REJECTED",
      "REVISION_REQUESTED",
    ].includes(q.status)
  )
    throw new NotEditable("This quotation cannot be revised.");
  if (q.status === "PENDING_APPROVAL" && q.ownerId !== actor.id)
    throw new Forbidden("Only the owner may withdraw a pending quotation.");
  await tx.approvalStep.updateMany({
    where: { request: { quotationId: q.id, status: "PENDING" } },
    data: { status: "SUPERSEDED" },
  });
  await tx.approvalRequest.updateMany({
    where: { quotationId: q.id, status: "PENDING" },
    data: { status: "SUPERSEDED", decidedAt: new Date() },
  });
  await tx.quotation.update({
    where: { id: q.id },
    data: {
      status: "DRAFT",
      approvedVersion: null,
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });
  await snapshotVersion(tx, q.id, actor, reason);
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: "USER",
    entityType: "Quotation",
    entityId: q.id,
    action: "QUOTATION.REVISION_STARTED",
    version: q.version + 1,
    reason,
  });
  return { id: q.id, version: q.version + 1 };
}
export async function createRevision(
  actor: SessionUser,
  raw: z.infer<typeof QuoteReasonInput>,
) {
  const input = QuoteReasonInput.parse(raw);
  const result = await withTx(async (tx) =>
    reviseInTx(
      tx,
      actor,
      await lockedQuote(tx, input.id, input.expectedVersion),
      input.reason,
    ),
  );
  await emit("quotation.activity", { quotationId: input.id });
  return result;
}
export async function cancelQuotation(
  actor: SessionUser,
  raw: z.infer<typeof QuoteReasonInput>,
) {
  const input = QuoteReasonInput.parse(raw);
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, input.id, input.expectedVersion);
    assertQuoteAccess(q, actor);
    if (["CONFIRMED", "CANCELLED"].includes(q.status))
      throw new NotEditable(
        "Confirmed or cancelled quotes cannot be cancelled.",
      );
    await tx.approvalStep.updateMany({
      where: { request: { quotationId: q.id, status: "PENDING" } },
      data: { status: "SUPERSEDED" },
    });
    await tx.approvalRequest.updateMany({
      where: { quotationId: q.id, status: "PENDING" },
      data: { status: "SUPERSEDED" },
    });
    await tx.quotation.update({
      where: { id: q.id },
      data: {
        status: "CANCELLED",
        approvedVersion: null,
        version: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Quotation",
      entityId: q.id,
      action: "QUOTATION.CANCELLED",
      reason: input.reason,
    });
    return { id: q.id };
  });
}

export async function setCustomer(
  actor: SessionUser,
  id: string,
  expectedVersion: number,
  customerId: string,
) {
  return withTx(async (tx) => {
    const q = await lockedQuote(tx, id, expectedVersion);
    assertEditable(q, actor);
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      include: { priceList: true },
    });
    if (!customer?.isActive)
      throw new ValidationError("Choose an active customer.");
    const updated = await tx.quotation.update({
      where: { id },
      data: {
        customerId,
        priceListId: customer.priceListId,
        currency: customer.priceList?.currency ?? customer.currency ?? DEFAULT_CURRENCY,
      },
    });
    for (const line of await tx.quotationLine.findMany({
      where: { quotationId: id },
    })) {
      const data = await catalogueSnapshot(tx, updated, {
        ...line,
        planId: line.planId ?? undefined,
      });
      await tx.quotationLine.update({ where: { id: line.id }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        actorType: "USER",
        entityType: "QuotationLine",
        entityId: line.id,
        action: "QUOTATION.LINE_REPRICED",
        before: { unitPriceMinor: line.unitPriceMinor },
        after: data,
      });
    }
    return finishEdit(tx, q, actor, "Customer and price list changed");
  });
}
export async function expireQuotations(now: Date) {
  return withTx(async (tx) => {
    const candidates = await tx.quotation.findMany({
      where: {
        status: { in: ["SENT", "UNDER_NEGOTIATION"] },
        validUntil: { lte: now },
      },
      select: { id: true },
    });
    let count = 0;
    for (const { id } of candidates) {
      const q = await lockedQuote(tx, id);
      if (
        !["SENT", "UNDER_NEGOTIATION"].includes(q.status) ||
        !q.validUntil ||
        q.validUntil > now
      )
        continue;
      await tx.quotation.update({ where: { id }, data: { status: "EXPIRED" } });
      await writeAudit(tx, {
        actorType: "SYSTEM",
        entityType: "Quotation",
        entityId: id,
        action: "QUOTATION.EXPIRED",
        version: q.version,
      });
      count++;
    }
    return count;
  });
}
