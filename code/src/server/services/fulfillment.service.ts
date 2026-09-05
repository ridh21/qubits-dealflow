import {
  issueShipmentInvoice,
  issueCompletionInvoice,
} from "./invoice.service";
import { Prisma } from "@prisma/client";
import { prisma, withTx, lockRow, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import {
  Forbidden,
  Conflict,
  ValidationError,
  NotFound,
} from "@/domain/errors";
import { getActivePolicy } from "./policy.service";
import { planSplit } from "@/domain/split/plan-split";
import { reserve, shipOut, lockStockRows } from "./stock.service";
import { nextNumber } from "@/server/sequences";
import { writeAudit } from "@/server/audit";
function requireOps(actor: SessionUser) {
  if (!["FINANCE", "ADMIN"].includes(actor.role)) throw new Forbidden();
}
async function warehouseStock(tx: Tx) {
  return (
    await tx.warehouse.findMany({
      where: { isActive: true },
      include: { stockLevels: true },
    })
  ).map((w) => ({
    ...w,
    warehouseId: w.id,
    available: Object.fromEntries(
      w.stockLevels.map((s) => [s.productId, s.onHand - s.reserved]),
    ),
  }));
}
export async function previewSplit(quotationId: string) {
  const [q, policy, stock] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { lines: { include: { product: true } } },
    }),
    getActivePolicy(prisma, "FULFILLMENT"),
    warehouseStock(prisma),
  ]);
  if (!q) throw new NotFound();
  if (
    !policy.payload.allowPreviewBeforeConfirmation ||
    !["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(q.status)
  )
    throw new ValidationError(
      "Preview requires a cleared quotation and enabled preview policy.",
    );
  return planSplit(
    q.lines.map((l) => ({
      orderLineId: l.id,
      productId: l.productId,
      qty: l.qty,
      isPhysical: l.product.type === "PHYSICAL",
    })),
    stock,
    policy.payload,
  );
}
export async function proposePlan(actor: SessionUser, orderId: string) {
  requireOps(actor);
  return withTx(async (tx) => {
    await lockRow(tx, "Order", orderId);
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true, plan: true },
    });
    if (order.status !== "OPEN")
      throw new ValidationError("Only open orders can be allocated.");
    if (order.plan) return order.plan;
    const policy = await getActivePolicy(tx, "FULFILLMENT"),
      plan = planSplit(
        order.lines.map((l) => ({
          orderLineId: l.id,
          productId: l.productId,
          qty: l.qty - l.qtyShipped,
          isPhysical: l.kind === "PHYSICAL",
        })),
        await warehouseStock(tx),
        policy.payload,
      );
    const row = await tx.fulfillmentPlan.create({
      data: {
        orderId,
        estimatedShipments: plan.shipments,
        estimatedCostMinor: plan.estimatedCostMinor,
        rationale: plan as unknown as Prisma.InputJsonValue,
        policyVersionId: policy.id,
        allocations: {
          create: plan.allocations.map((a) => ({
            orderLineId: a.orderLineId,
            warehouseId: a.warehouseId,
            qty: a.qty,
          })),
        },
      },
    });
    for (const b of plan.backorders)
      await tx.backorder.create({
        data: { orderLineId: b.orderLineId, qty: b.qty },
      });
    await tx.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: plan.backorders.length
          ? "BACKORDERED"
          : "UNALLOCATED",
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "FulfillmentPlan",
      entityId: row.id,
      action: "FULFILLMENT.PROPOSED",
      after: plan as unknown as Prisma.InputJsonValue,
    });
    return row;
  });
}
export async function acceptPlan(
  actor: SessionUser,
  orderId: string,
  expectedPlanId: string,
) {
  requireOps(actor);
  return withTx(async (tx) => {
    await lockRow(tx, "Order", orderId);
    const plan = await tx.fulfillmentPlan.findUnique({
      where: { orderId },
      include: { allocations: { include: { orderLine: true } }, order: true },
    });
    if (!plan || plan.id !== expectedPlanId)
      throw new Conflict("The plan changed. Reload before reserving.");
    if (plan.status !== "SUGGESTED") return { id: plan.id };
    if (plan.order.status !== "OPEN")
      throw new ValidationError("Order is not open.");
    await lockStockRows(
      tx,
      plan.allocations.map((a) => ({
        warehouseId: a.warehouseId,
        productId: a.orderLine.productId,
      })),
    );
    for (const a of plan.allocations) {
      await reserve(tx, {
        warehouseId: a.warehouseId,
        productId: a.orderLine.productId,
        qty: a.qty,
        refId: a.id,
        actorId: actor.id,
      });
      await tx.allocation.update({
        where: { id: a.id },
        data: { reserved: true },
      });
    }
    for (const warehouseId of [
      ...new Set(plan.allocations.map((a) => a.warehouseId)),
    ]) {
      await tx.shipment.create({
        data: {
          number: await nextNumber(tx, "SHP"),
          orderId,
          warehouseId,
          lines: {
            create: plan.allocations
              .filter((a) => a.warehouseId === warehouseId)
              .map((a) => ({ orderLineId: a.orderLineId, qty: a.qty })),
          },
        },
      });
    }
    await tx.fulfillmentPlan.update({
      where: { id: plan.id },
      data: {
        status:
          (plan.rationale as Record<string, unknown> | null)?.method ===
          "MANUAL"
            ? "OVERRIDDEN"
            : "ACCEPTED",
        decidedAt: new Date(),
        decidedById: actor.id,
      },
    });
    const backorders = await tx.backorder.count({
      where: {
        orderLine: { orderId },
        status: { in: ["OPEN", "CONSOLIDATION_SUGGESTED"] },
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: backorders ? "BACKORDERED" : "RESERVED" },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "FulfillmentPlan",
      entityId: plan.id,
      action: "FULFILLMENT.ACCEPTED",
    });
    return { id: plan.id };
  });
}
export async function markShipped(actor: SessionUser, shipmentId: string) {
  requireOps(actor);
  return withTx(async (tx) => {
    const initial = await tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    await lockRow(tx, "Order", initial.orderId);
    await lockRow(tx, "Shipment", shipmentId);
    const shipment = await tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { lines: { include: { orderLine: true } } },
    });
    if (shipment.status === "SHIPPED") {
      await issueShipmentInvoice(tx, shipment.id);
      return { id: shipment.id };
    }
    await lockStockRows(
      tx,
      shipment.lines.map((l) => ({
        warehouseId: shipment.warehouseId,
        productId: l.orderLine.productId,
      })),
    );
    for (const line of shipment.lines) {
      const allocations = await tx.allocation.findMany({
        where: {
          plan: { orderId: shipment.orderId },
          warehouseId: shipment.warehouseId,
          orderLineId: line.orderLineId,
          reserved: true,
        },
        orderBy: { id: "asc" },
      });
      let remaining = line.qty;
      for (const a of allocations) {
        const qty = Math.min(remaining, a.qty - a.qtyShipped);
        if (qty <= 0) continue;
        await shipOut(tx, {
          warehouseId: a.warehouseId,
          productId: line.orderLine.productId,
          qty,
          refId: a.id,
          actorId: actor.id,
        });
        await tx.allocation.update({
          where: { id: a.id },
          data: { qtyShipped: { increment: qty } },
        });
        remaining -= qty;
      }
      if (remaining) throw new Conflict("Shipment exceeds reserved quantity.");
      await tx.orderLine.update({
        where: { id: line.orderLineId },
        data: { qtyShipped: { increment: line.qty } },
      });
    }
    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: "SHIPPED", shippedAt: new Date(), shippedById: actor.id },
    });
    const lines = await tx.orderLine.findMany({
        where: { orderId: shipment.orderId, kind: "PHYSICAL" },
      }),
      backorders = await tx.backorder.count({
        where: {
          orderLine: { orderId: shipment.orderId },
          status: { in: ["OPEN", "CONSOLIDATION_SUGGESTED"] },
        },
      });
    await tx.order.update({
      where: { id: shipment.orderId },
      data: {
        fulfillmentStatus: lines.every((l) => l.qtyShipped === l.qty)
          ? "FULFILLED"
          : backorders
            ? "BACKORDERED"
            : "PARTIALLY_FULFILLED",
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Shipment",
      entityId: shipmentId,
      action: "SHIPMENT.DISPATCHED",
    });
    await issueShipmentInvoice(tx, shipmentId);
    return { id: shipmentId };
  });
}
export async function recordServiceCompletion(
  actor: SessionUser,
  orderLineId: string,
  note: string,
) {
  requireOps(actor);
  return withTx(async (tx) => {
    const line = await tx.orderLine.findUniqueOrThrow({
      where: { id: orderLineId },
    });
    await lockRow(tx, "Order", line.orderId);
    if (line.kind !== "SERVICE")
      throw new ValidationError("Only service lines can be completed.");
    const existing = await tx.serviceCompletion.findUnique({
      where: { orderLineId },
    });
    if (existing) {
      await issueCompletionInvoice(tx, existing.id);
      return existing;
    }
    const completion = await tx.serviceCompletion.create({
      data: {
        orderId: line.orderId,
        orderLineId,
        completedAt: new Date(),
        recordedById: actor.id,
        note,
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "ServiceCompletion",
      entityId: completion.id,
      action: "SERVICE.COMPLETED",
      reason: note,
    });
    await issueCompletionInvoice(tx, completion.id);
    return completion;
  });
}

export async function overridePlan(
  actor: SessionUser,
  orderId: string,
  allocations: { orderLineId: string; warehouseId: string; qty: number }[],
  note: string,
) {
  requireOps(actor);
  if (!note.trim()) throw new ValidationError("Explain the manual allocation.");
  return withTx(async (tx) => {
    await lockRow(tx, "Order", orderId);
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { plan: true, lines: true },
    });
    if (!order.plan || order.plan.status !== "SUGGESTED")
      throw new Conflict("Only an unreserved suggested plan can be replaced.");
    const seen = new Set<string>();
    for (const a of allocations) {
      const key = `${a.orderLineId}:${a.warehouseId}`;
      if (
        seen.has(key) ||
        !Number.isInteger(a.qty) ||
        a.qty <= 0 ||
        !order.lines.some(
          (l) => l.id === a.orderLineId && l.kind === "PHYSICAL",
        )
      )
        throw new ValidationError(
          "Choose valid unique physical-line allocations.",
        );
      seen.add(key);
    }
    const stock = await warehouseStock(tx),
      policy = await getActivePolicy(tx, "FULFILLMENT");
    if (
      new Set(allocations.map((a) => a.warehouseId)).size >
      policy.payload.maxWarehousesPerOrder
    )
      throw new ValidationError(
        "Allocation exceeds the warehouse policy limit.",
      );
    for (const l of order.lines) {
      if (
        allocations
          .filter((a) => a.orderLineId === l.id)
          .reduce((s, a) => s + a.qty, 0) >
        l.qty - l.qtyShipped
      )
        throw new ValidationError("Allocation exceeds ordered quantity.");
    }
    for (const w of new Set(allocations.map((a) => a.warehouseId))) {
      const warehouse = stock.find((s) => s.warehouseId === w);
      if (!warehouse) throw new ValidationError("Choose an active warehouse.");
      for (const productId of new Set(order.lines.map((l) => l.productId))) {
        const qty = allocations
          .filter(
            (a) =>
              a.warehouseId === w &&
              order.lines.find((l) => l.id === a.orderLineId)?.productId ===
                productId,
          )
          .reduce((s, a) => s + a.qty, 0);
        if (qty > (warehouse.available[productId] ?? 0))
          throw new ValidationError("Allocation exceeds available stock.");
      }
    }
    await tx.allocation.deleteMany({ where: { planId: order.plan.id } });
    await tx.backorder.deleteMany({
      where: { orderLine: { orderId }, status: "OPEN" },
    });
    for (const a of allocations)
      await tx.allocation.create({ data: { ...a, planId: order.plan.id } });
    for (const l of order.lines.filter((l) => l.kind === "PHYSICAL")) {
      const qty =
        l.qty -
        l.qtyShipped -
        allocations
          .filter((a) => a.orderLineId === l.id)
          .reduce((s, a) => s + a.qty, 0);
      if (qty) await tx.backorder.create({ data: { orderLineId: l.id, qty } });
    }
    const warehousesUsed = [...new Set(allocations.map((a) => a.warehouseId))];
    const estimatedCostMinor = warehousesUsed.reduce((total, warehouseId) => {
      const warehouse = stock.find((w) => w.warehouseId === warehouseId)!;
      const quantity = allocations
        .filter((a) => a.warehouseId === warehouseId)
        .reduce((sum, a) => sum + a.qty, 0);
      return (
        total +
        warehouse.fixedShipmentCostMinor +
        quantity * warehouse.shippingCostWeightMinor
      );
    }, 0);
    await tx.fulfillmentPlan.update({
      where: { id: order.plan.id },
      data: {
        estimatedShipments: warehousesUsed.length,
        estimatedCostMinor,
        rationale: {
          method: "MANUAL",
          rationale: [note],
          warehousesUsed,
          allocations,
        },
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "FulfillmentPlan",
      entityId: order.plan.id,
      action: "FULFILLMENT.OVERRIDDEN",
      after: allocations,
      reason: note,
    });
    return { id: order.plan.id };
  });
}
export async function consolidateBackorder(
  actor: SessionUser,
  backorderId: string,
  warehouseId: string,
  qty: number,
) {
  requireOps(actor);
  return withTx(async (tx) => {
    const initial = await tx.backorder.findUniqueOrThrow({
      where: { id: backorderId },
      include: { orderLine: true },
    });
    await lockRow(tx, "Order", initial.orderLine.orderId);
    await lockRow(tx, "Backorder", backorderId);
    const b = await tx.backorder.findUniqueOrThrow({
      where: { id: backorderId },
      include: {
        orderLine: { include: { order: { include: { plan: true } } } },
      },
    });
    if (
      !["OPEN", "CONSOLIDATION_SUGGESTED"].includes(b.status) ||
      !Number.isInteger(qty) ||
      qty <= 0 ||
      qty > b.qty
    )
      throw new ValidationError("Choose a quantity within the open backorder.");
    const plan = b.orderLine.order.plan;
    if (!plan || plan.status === "SUGGESTED")
      throw new ValidationError(
        "Accept the initial allocation before consolidating.",
      );
    const warehouse = await tx.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse?.isActive)
      throw new ValidationError("Choose an active warehouse.");
    const allocation = await tx.allocation.create({
      data: {
        planId: plan.id,
        orderLineId: b.orderLineId,
        warehouseId,
        qty,
        reserved: true,
      },
    });
    await reserve(tx, {
      warehouseId,
      productId: b.orderLine.productId,
      qty,
      refId: allocation.id,
      actorId: actor.id,
    });
    const shipment = await tx.shipment.create({
      data: {
        number: await nextNumber(tx, "SHP"),
        orderId: b.orderLine.orderId,
        warehouseId,
        lines: { create: { orderLineId: b.orderLineId, qty } },
      },
    });
    await tx.backorder.update({
      where: { id: backorderId },
      data:
        qty === b.qty
          ? { status: "ALLOCATED" }
          : { qty: b.qty - qty, status: "OPEN" },
    });
    const openBackorders = await tx.backorder.count({
      where: {
        orderLine: { orderId: b.orderLine.orderId },
        status: { in: ["OPEN", "CONSOLIDATION_SUGGESTED"] },
      },
    });
    await tx.order.update({
      where: { id: b.orderLine.orderId },
      data: { fulfillmentStatus: openBackorders ? "BACKORDERED" : "RESERVED" },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      actorType: "USER",
      entityType: "Backorder",
      entityId: backorderId,
      action: "BACKORDER.CONSOLIDATED",
      after: { warehouseId, qty, shipmentId: shipment.id },
    });
    return { id: shipment.id };
  });
}
