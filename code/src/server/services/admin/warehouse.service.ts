import { z } from "zod";
import { prisma, withTx, type Tx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { emit } from "@/server/events";
import { Conflict, NotFound, ValidationError } from "@/domain/errors";
import {
  AdjustStockInput,
  ReceiveStockInput,
  ReorderPointInput,
  ReplenishmentInput,
  WarehouseInput,
} from "@/lib/zod-schemas/admin";
import type { SessionUser } from "@/server/auth/guards";

type WhInput = z.infer<typeof WarehouseInput>;

export async function createWarehouse(actor: SessionUser, input: WhInput) {
  const clash = await prisma.warehouse.findFirst({
    where: { OR: [{ name: input.name }, { code: input.code }] },
  });
  if (clash) throw new ValidationError("A warehouse with that name or code already exists.");

  return withTx(async (tx) => {
    const wh = await tx.warehouse.create({ data: input });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Warehouse",
      entityId: wh.id,
      action: "WAREHOUSE.CREATED",
      after: { name: wh.name, code: wh.code },
    });
    return wh;
  });
}

export async function updateWarehouse(actor: SessionUser, id: string, input: WhInput) {
  const before = await prisma.warehouse.findUnique({ where: { id } });
  if (!before) throw new NotFound("That warehouse no longer exists.");

  return withTx(async (tx) => {
    const wh = await tx.warehouse.update({ where: { id }, data: input });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Warehouse",
      entityId: id,
      action: "WAREHOUSE.UPDATED",
      before: {
        shippingCostWeightMinor: before.shippingCostWeightMinor,
        fixedShipmentCostMinor: before.fixedShipmentCostMinor,
        priority: before.priority,
      },
      after: input,
    });
    return wh;
  });
}

/** Reserved stock belongs to live orders, so it blocks deactivation. */
export async function setWarehouseActive(actor: SessionUser, id: string, isActive: boolean) {
  if (!isActive) {
    const reserved = await prisma.stockLevel.aggregate({
      where: { warehouseId: id },
      _sum: { reserved: true },
    });
    if ((reserved._sum.reserved ?? 0) > 0) {
      throw new Conflict("This warehouse still holds reserved stock for open orders.");
    }
  }

  return withTx(async (tx) => {
    const wh = await tx.warehouse.update({ where: { id }, data: { isActive } });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Warehouse",
      entityId: id,
      action: isActive ? "WAREHOUSE.REACTIVATED" : "WAREHOUSE.DEACTIVATED",
      after: { isActive },
    });
    return wh;
  });
}

async function ensureStockLevel(tx: Tx, warehouseId: string, productId: string) {
  return tx.stockLevel.upsert({
    where: { warehouseId_productId: { warehouseId, productId } },
    update: {},
    create: { warehouseId, productId },
  });
}

export async function receiveStock(actor: SessionUser, input: z.infer<typeof ReceiveStockInput>) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new NotFound("That product no longer exists.");
  if (product.type !== "PHYSICAL") {
    throw new ValidationError("Only physical products hold stock.");
  }

  const result = await withTx(async (tx) => {
    await ensureStockLevel(tx, input.warehouseId, input.productId);
    const level = await tx.stockLevel.update({
      where: {
        warehouseId_productId: { warehouseId: input.warehouseId, productId: input.productId },
      },
      data: { onHand: { increment: input.qty } },
    });
    await tx.stockMovement.create({
      data: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        qty: input.qty,
        type: "RECEIPT",
        note: input.note ?? null,
        refType: input.replenishmentPlanId ? "ReplenishmentPlan" : null,
        refId: input.replenishmentPlanId || null,
        actorId: actor.id,
      },
    });
    if (input.replenishmentPlanId) {
      await tx.replenishmentPlan.update({
        where: { id: input.replenishmentPlanId },
        data: { status: "RECEIVED" },
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "StockLevel",
      entityId: level.id,
      action: "STOCK.RECEIVED",
      after: { qty: input.qty, onHand: level.onHand },
      reason: input.note ?? null,
    });
    return level;
  });

  await emit("stock.received", {
    warehouseId: input.warehouseId,
    productId: input.productId,
    qty: input.qty,
  });
  return result;
}

/** On-hand can never drop below what is already reserved for open orders. */
export async function adjustStock(actor: SessionUser, input: z.infer<typeof AdjustStockInput>) {
  return withTx(async (tx) => {
    await ensureStockLevel(tx, input.warehouseId, input.productId);
    const current = await tx.stockLevel.findUniqueOrThrow({
      where: {
        warehouseId_productId: { warehouseId: input.warehouseId, productId: input.productId },
      },
    });
    const nextOnHand = current.onHand + input.delta;
    if (nextOnHand < 0) throw new ValidationError("That would take on-hand stock below zero.");
    if (nextOnHand < current.reserved) {
      throw new Conflict(
        `That would leave ${nextOnHand} on hand against ${current.reserved} already reserved.`,
      );
    }

    const level = await tx.stockLevel.update({
      where: { id: current.id },
      data: { onHand: nextOnHand },
    });
    await tx.stockMovement.create({
      data: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        qty: input.delta,
        type: "ADJUST",
        note: input.reason,
        actorId: actor.id,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "StockLevel",
      entityId: level.id,
      action: "STOCK.ADJUSTED",
      before: { onHand: current.onHand },
      after: { onHand: nextOnHand },
      reason: input.reason,
    });
    return level;
  });
}

export async function setReorderPoint(
  actor: SessionUser,
  input: z.infer<typeof ReorderPointInput>,
) {
  return withTx(async (tx) => {
    await ensureStockLevel(tx, input.warehouseId, input.productId);
    const level = await tx.stockLevel.update({
      where: {
        warehouseId_productId: { warehouseId: input.warehouseId, productId: input.productId },
      },
      data: { reorderPoint: input.reorderPoint },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "StockLevel",
      entityId: level.id,
      action: "STOCK.REORDER_POINT_SET",
      after: { reorderPoint: input.reorderPoint },
    });
    return level;
  });
}

export async function createReplenishmentPlan(
  actor: SessionUser,
  input: z.infer<typeof ReplenishmentInput>,
) {
  return withTx(async (tx) => {
    const plan = await tx.replenishmentPlan.create({ data: input });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "ReplenishmentPlan",
      entityId: plan.id,
      action: "REPLENISHMENT.CREATED",
      after: { qty: plan.qty, eta: plan.eta.toISOString() },
    });
    return plan;
  });
}

export async function cancelReplenishmentPlan(actor: SessionUser, id: string) {
  return withTx(async (tx) => {
    const plan = await tx.replenishmentPlan.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "ReplenishmentPlan",
      entityId: id,
      action: "REPLENISHMENT.CANCELLED",
      after: { status: "CANCELLED" },
    });
    return plan;
  });
}

export interface WarehouseAvailability {
  warehouseId: string;
  code: string;
  name: string;
  shippingCostWeightMinor: number;
  fixedShipmentCostMinor: number;
  priority: number;
  available: Record<string, number>;
}

/**
 * Availability = on hand minus reserved, per active warehouse. Phase 06's
 * split optimiser reads this together with the shipping weights.
 */
export async function availabilityMap(
  tx: Tx,
  productIds: string[],
): Promise<WarehouseAvailability[]> {
  const warehouses = await tx.warehouse.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });
  const levels = await tx.stockLevel.findMany({
    where: { productId: { in: productIds } },
  });

  return warehouses.map((w) => {
    const available: Record<string, number> = {};
    for (const id of productIds) available[id] = 0;
    for (const l of levels) {
      if (l.warehouseId !== w.id) continue;
      available[l.productId] = Math.max(0, l.onHand - l.reserved);
    }
    return {
      warehouseId: w.id,
      code: w.code,
      name: w.name,
      shippingCostWeightMinor: w.shippingCostWeightMinor,
      fixedShipmentCostMinor: w.fixedShipmentCostMinor,
      priority: w.priority,
      available,
    };
  });
}
