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
  return { quote, actor };
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
export async function quotationCustomers() {
  await requireInternal();
  return prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, tier: true },
    orderBy: { name: "asc" },
  });
}
