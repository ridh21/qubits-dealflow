import { cache } from "react";
import { prisma } from "@/server/db";
import { requireInternal, type SessionUser } from "@/server/auth/guards";
import { type PolicyKind } from "@/domain/policy/schemas";
import { parsePolicy } from "@/domain/policy/validate-discount-risk";
import { NotFound } from "@/domain/errors";
import { resolveUnitPrice } from "@/domain/pricing/resolve-price";

export const getPolicyOverview = cache(async () => {
  await requireInternal();
  const rows = await prisma.policyVersion.findMany({
    where: { isActive: true },
    orderBy: { kind: "asc" },
  });
  const authors = await prisma.user.findMany({
    where: {
      id: {
        in: rows.flatMap((r) => (r.publishedById ? [r.publishedById] : [])),
      },
    },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({
    ...r,
    publishedByName:
      authors.find((a) => a.id === r.publishedById)?.name ?? "System",
  }));
});
export async function getPolicyEditorData(kind: PolicyKind) {
  const actor = await requireInternal();
  const [active, categories, products, pendingCount] = await Promise.all([
    prisma.policyVersion.findFirst({ where: { kind, isActive: true } }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    kind === "RECOMMENDATION"
      ? prisma.product.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
  ]);
  return {
    actor,
    active: active
      ? {
          id: active.id,
          version: active.version,
          payload: parsePolicy(kind, active.payload),
        }
      : null,
    categories,
    products,
    pendingCount,
  };
}
export function policyQuoteScope(actor: SessionUser) {
  return actor.role === "SALES_REP"
    ? { ownerId: actor.id }
    : actor.role === "SALES_MANAGER"
      ? {
          OR: [
            { ownerId: actor.id },
            ...(actor.teamId ? [{ owner: { teamId: actor.teamId } }] : []),
          ],
        }
      : {};
}
export async function listPolicySampleQuotes(actor: SessionUser, query = "") {
  return prisma.quotation.findMany({
    where: {
      ...policyQuoteScope(actor),
      number: { contains: query.slice(0, 100), mode: "insensitive" },
    },
    select: { id: true, number: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
}
export async function getPolicySampleQuote(actor: SessionUser, id: string) {
  const quote = await prisma.quotation.findFirst({
    where: { id, ...policyQuoteScope(actor) },
    include: {
      customer: true,
      lines: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
  if (!quote) throw new NotFound("Quotation unavailable in your scope.");
  return quote;
}
export async function getFulfillmentSample(
  actor: SessionUser,
  quoteId: string,
) {
  const quote = await getPolicySampleQuote(actor, quoteId);
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      stockLevels: {
        where: { productId: { in: quote.lines.map((l) => l.productId) } },
      },
    },
  });
  return {
    confirmed: quote.status === "CONFIRMED",
    lines: quote.lines
      .filter((l) => l.product.type === "PHYSICAL")
      .map((l) => ({ productId: l.productId, qty: l.qty })),
    warehouses: warehouses.map((w) => ({
      ...w,
      available: Object.fromEntries(
        w.stockLevels.map((s) => [
          s.productId,
          Math.max(0, s.onHand - s.reserved),
        ]),
      ),
    })),
  };
}
export async function getRecommendationSample(
  actor: SessionUser,
  quoteId: string,
) {
  const quote = await getPolicySampleQuote(actor, quoteId);
  const [products, priceList] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: { stockLevels: true },
    }),
    (quote.priceListId ?? quote.customer.priceListId)
      ? prisma.priceList.findUnique({
          where: { id: (quote.priceListId ?? quote.customer.priceListId)! },
          include: { items: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    productIds: quote.lines.map((l) => l.productId),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceMinor: resolveUnitPrice(p, [], priceList),
      costMinor: p.costPriceMinor,
      minMarginBp: p.minMarginBp,
      active: true,
      promoted: p.isPromoted,
      available:
        p.type !== "PHYSICAL" ||
        p.stockLevels.some((s) => s.onHand > s.reserved),
    })),
  };
}
