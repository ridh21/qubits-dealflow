import { Prisma, QuotationStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireInternal, type SessionUser } from "@/server/auth/guards";
import { NotFound } from "@/domain/errors";
import {
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";
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
  const actor = await requireInternal(),
    p = parseListParams(
      sp,
      z.object({
        status: z.nativeEnum(QuotationStatus).optional(),
        customerId: z.string().optional(),
        ownerId: z.string().optional(),
        riskBand: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        view: z.enum(["table", "board"]).default("table"),
      }),
    );
  const where: Prisma.QuotationWhereInput = {
    AND: [
      quotationScope(actor),
      {
        ...(p.q
          ? {
              OR: [
                { number: { contains: p.q, mode: "insensitive" } },
                { customer: { name: { contains: p.q, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(p.filters.status ? { status: p.filters.status } : {}),
        ...(p.filters.customerId ? { customerId: p.filters.customerId } : {}),
        ...(p.filters.ownerId ? { ownerId: p.filters.ownerId } : {}),
        ...(p.filters.riskBand ? { riskBand: p.filters.riskBand } : {}),
      },
    ],
  };
  const orderBy: Prisma.QuotationOrderByWithRelationInput =
    p.sort === "totalMinor"
      ? { totalMinor: p.dir }
      : p.sort === "number"
        ? { number: p.dir }
        : { updatedAt: p.dir };
  return {
    ...(await paginate(
      () => prisma.quotation.count({ where }),
      (skip, take) =>
        prisma.quotation.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            customer: { select: { name: true } },
            owner: { select: { name: true } },
          },
        }),
      p,
    )),
    view: p.filters.view,
    actor,
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
