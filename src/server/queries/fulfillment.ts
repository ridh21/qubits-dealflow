import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { quotationScope } from "./quotations";
import { NotFound } from "@/domain/errors";
export async function listFulfillment() {
  const actor = await requireInternal();
  return prisma.order.findMany({
    where: { quotation: quotationScope(actor) },
    include: { customer: { select: { name: true } }, lines: true },
    orderBy: { confirmedAt: "desc" },
    take: 100,
  });
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
