import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  orderByOf,
  paginate,
  parseListParams,
  type SearchParamsRecord,
} from "@/server/list";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
const FulfillmentFilters = z.object({
  fulfillmentStatus: z
    .enum([
      "UNALLOCATED",
      "RESERVED",
      "PARTIALLY_FULFILLED",
      "BACKORDERED",
      "FULFILLED",
    ])
    .optional(),
  status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
});

export async function listFulfillment(sp: SearchParamsRecord) {
  const actor = await requireInternal();
  const p = parseListParams(sp, FulfillmentFilters);

  const where: Prisma.OrderWhereInput = {
    quotation: quotationScope(actor),
    ...(p.filters.fulfillmentStatus
      ? { fulfillmentStatus: p.filters.fulfillmentStatus }
      : {}),
    ...(p.filters.status ? { status: p.filters.status } : {}),
    ...(p.q
      ? {
          OR: [
            { number: { contains: p.q, mode: "insensitive" } },
            { customer: { name: { contains: p.q, mode: "insensitive" } } },
            // People arrive here holding a quotation number, having just
            // confirmed it. Without this the order looks absent.
            { quotation: { number: { contains: p.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orderBy = orderByOf(
    p.sort,
    p.dir,
    ["number", "confirmedAt", "promisedDeliveryDate", "fulfillmentStatus"],
    { confirmedAt: "desc" },
  );

  const result = await paginate(
    () => prisma.order.count({ where }),
    (skip, take) =>
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          customer: { select: { name: true } },
          quotation: { select: { id: true, number: true } },
          lines: true,
        },
      }),
    p,
  );
  return { ...result, params: p };
}
export async function getFulfillment(id: string) {
  const actor = await requireInternal();
  const order = await prisma.order.findFirst({
    where: { id, quotation: quotationScope(actor) },
    include: {
      customer: { select: { name: true } },
      lines: { include: { completion: true, backorders: true } },
      plan: {
        include: {
          allocations: { include: { warehouse: true, orderLine: true } },
        },
      },
      shipments: {
        include: { warehouse: { select: { name: true } }, lines: true },
      },
    },
  });
  if (!order) throw new NotFound("Order unavailable in your scope.");
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: { stockLevels: true },
    orderBy: { priority: "asc" },
  });
  return { actor, order, warehouses };
}
