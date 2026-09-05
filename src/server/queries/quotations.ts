import { Prisma } from "@prisma/client";
import { parseQuotationListParams } from "@/domain/quotation/list-params";
import { quotationListWhere, quotationListOrder } from "./quotation-list";
import { prisma } from "@/server/db";
import { requireInternal, type SessionUser } from "@/server/auth/guards";
import { NotFound } from "@/domain/errors";
import { paginate, type SearchParamsRecord } from "@/server/list";
export function quotationScope(actor: SessionUser): Prisma.QuotationWhereInput {
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
export async function listQuotations(sp: SearchParamsRecord) {
  const actor = await requireInternal();
  const p = parseQuotationListParams(sp);
  const scope = quotationScope(actor);
  const where = quotationListWhere(scope, p);
  const [result, owners, teams, customers] = await Promise.all([
    paginate(
      () => prisma.quotation.count({ where }),
      (skip, take) =>
        prisma.quotation.findMany({
          where,
          orderBy: quotationListOrder(p),
          skip,
          take,
          select: {
            id: true,
            number: true,
            version: true,
            status: true,
            currency: true,
            totalMinor: true,
            oneTimeNetMinor: true,
            riskBand: true,
            createdAt: true,
            updatedAt: true,
            customer: { select: { name: true } },
            owner: { select: { name: true } },
          },
        }),
      p,
    ),
    prisma.user.findMany({
      where: { ownedQuotations: { some: scope } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.team.findMany({
      where: { users: { some: { ownedQuotations: { some: scope } } } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.customer.findMany({
      where: { quotations: { some: scope } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    ...result,
    view: p.view,
    params: p,
    actor,
    options: { owners, teams, customers },
  };
}
export async function getQuotation(id: string) {
  const actor = await requireInternal();
  const quote = await prisma.quotation.findFirst({
    where: { id, ...quotationScope(actor) },
    include: {
      customer: true,
      owner: { select: { name: true, email: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { plan: { include: { tier: true } } },
      },
      versions: { orderBy: { version: "desc" } },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { steps: { orderBy: { index: "asc" } } },
      },
      messages: { orderBy: { createdAt: "asc" } },
      order: { select: { id: true, number: true } },
    },
  });
  if (!quote) throw new NotFound("Quotation unavailable in your scope.");

  // Version history shows which customer each snapshot had. Resolve only the
  // ids those snapshots actually reference, rather than shipping every
  // customer to the page.
  const referenced = [
    ...new Set(
      quote.versions
        .map(
          (v) =>
            (v.snapshot as { customerId?: string | null } | null)?.customerId,
        )
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const customerNames = Object.fromEntries(
    referenced.length
      ? (
          await prisma.customer.findMany({
            where: { id: { in: referenced } },
            select: { id: true, name: true },
          })
        ).map((c) => [c.id, c.name])
      : [],
  );

  return { quote, actor, customerNames };
}
export async function quotationCatalogue() {
  await requireInternal();
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      category: true,
      attributes: { include: { values: true } },
      plans: { where: { isActive: true }, include: { tier: true } },
      stockLevels: true,
    },
  });
}
/**
 * Customer options for the quotation picker.
 *
 * Bounded and search-driven: the picker asks as the user types instead of every
 * quotation page shipping the entire customer list. An empty term returns
 * nothing rather than the first page - opening the dropdown costs no query.
 */
export async function searchQuotationCustomers(query: string, take = 20) {
  await requireInternal();
  const q = query.trim();
  // No term, no query. This is the guard that stops an accidental caller from
  // turning the picker back into a full customer-table read.
  if (!q) return [];
  return prisma.customer.findMany({
    where: { isActive: true, name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, tier: true },
    orderBy: { name: "asc" },
    take,
  });
}
