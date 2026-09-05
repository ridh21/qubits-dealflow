import type { Tx } from "@/server/db";
import { lockRow } from "@/server/db";
import { InsufficientStock, NotFound, ValidationError } from "@/domain/errors";
import { writeAudit } from "@/server/audit";
export interface StockOperation {
  warehouseId: string;
  productId: string;
  qty: number;
  refId: string;
  actorId: string;
}
/** Lock hierarchy: order/backorder, sorted warehouses, then sorted stock rows. */
export async function lockWarehouseRows(
  tx: Tx,
  ids: string[],
  requireActive = true,
) {
  for (const id of [...new Set(ids)].sort()) {
    await lockRow(tx, "Warehouse", id);
    const warehouse = await tx.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFound("Warehouse unavailable.");
    if (requireActive && !warehouse.isActive)
      throw new ValidationError("Warehouse is inactive. Recompute the allocation.");
  }
}
export async function lockStockRows(
  tx: Tx,
  pairs: { warehouseId: string; productId: string }[],
) {
  await lockWarehouseRows(tx, pairs.map((pair) => pair.warehouseId));
  if (!pairs.length) return;
  const rows = await tx.stockLevel.findMany({
    where: { OR: pairs },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const row of rows) await lockRow(tx, "StockLevel", row.id);
}
async function move(
  tx: Tx,
  input: StockOperation,
  type: "RESERVE" | "RELEASE" | "SHIP",
) {
  if (!Number.isInteger(input.qty) || input.qty <= 0)
    throw new ValidationError("Stock quantities must be positive whole units.");
  await lockWarehouseRows(tx, [input.warehouseId], type !== "RELEASE");
  const row = await tx.stockLevel.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    },
  });
  if (!row) throw new NotFound("Stock record unavailable.");
  await lockRow(tx, "StockLevel", row.id);
  const stock = await tx.stockLevel.findUniqueOrThrow({
    where: { id: row.id },
  });
  if (
    type === "RESERVE"
      ? stock.onHand - stock.reserved < input.qty
      : stock.reserved < input.qty
  )
    throw new InsufficientStock(
      "Stock changed. Refresh the allocation before continuing.",
    );
  const after = await tx.stockLevel.update({
    where: { id: stock.id },
    data:
      type === "RESERVE"
        ? { reserved: { increment: input.qty } }
        : type === "RELEASE"
          ? { reserved: { decrement: input.qty } }
          : {
              onHand: { decrement: input.qty },
              reserved: { decrement: input.qty },
            },
  });
  await tx.stockMovement.create({
    data: { ...input, refType: "ALLOCATION", type },
  });
  await writeAudit(tx, {
    actorId: input.actorId,
    actorType: "USER",
    entityType: "StockLevel",
    entityId: stock.id,
    action: `STOCK.${type}`,
    before: { onHand: stock.onHand, reserved: stock.reserved },
    after: { onHand: after.onHand, reserved: after.reserved },
  });
}
export const reserve = (tx: Tx, input: StockOperation) =>
  move(tx, input, "RESERVE");
export const release = (tx: Tx, input: StockOperation) =>
  move(tx, input, "RELEASE");
export const shipOut = (tx: Tx, input: StockOperation) =>
  move(tx, input, "SHIP");
