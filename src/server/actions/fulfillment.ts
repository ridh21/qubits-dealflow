"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAction } from "./run-action";
import * as service from "@/server/services/fulfillment.service";
const roles = ["ADMIN", "FINANCE"],
  paths = ["/fulfillment", "/invoices"],
  id = z.string().min(1);
export async function proposePlanAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({ orderId: id }),
    input,
    execute: (a, d) => service.proposePlan(a, d.orderId),
    paths,
  });
}
export async function acceptPlanAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({ orderId: id, planId: id }),
    input,
    execute: async (a, d) => {
      try {
        return await service.acceptPlan(a, d.orderId, d.planId);
      } finally {
        // Availability conflicts may have committed a new suggestion.
        revalidatePath(`/fulfillment/${d.orderId}`);
        revalidatePath("/fulfillment");
      }
    },
    paths,
  });
}
export async function shipAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({ shipmentId: id }),
    input,
    execute: (a, d) => service.markShipped(a, d.shipmentId),
    paths,
  });
}
export async function completeServiceAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({ lineId: id, note: z.string().max(1000) }),
    input,
    execute: (a, d) => service.recordServiceCompletion(a, d.lineId, d.note),
    paths,
  });
}
export async function consolidateAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      backorderId: id,
      warehouseId: id,
      qty: z.number().int().positive(),
    }),
    input,
    execute: (a, d) =>
      service.consolidateBackorder(a, d.backorderId, d.warehouseId, d.qty),
    paths,
  });
}
export async function overridePlanAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      orderId: id,
      allocations: z
        .array(
          z.object({
            orderLineId: id,
            warehouseId: id,
            qty: z.number().int().positive(),
          }),
        )
        .max(500),
      note: z.string().trim().min(1).max(1000),
    }),
    input,
    execute: (a, d) =>
      service.overridePlan(a, d.orderId, d.allocations, d.note),
    paths,
  });
}

export async function decideConsolidationAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      backorderId: id,
      decision: z.enum(["ACCEPT", "DECLINE"]),
      warehouseId: id,
      qty: z.number().int().positive(),
    }),
    input,
    execute: (actor, data) => {
      const expected = { warehouseId: data.warehouseId, qty: data.qty };
      return data.decision === "DECLINE"
        ? service.declineConsolidation(actor, data.backorderId, expected)
        : service.consolidateBackorder(
            actor,
            data.backorderId,
            data.warehouseId,
            data.qty,
            expected,
          );
    },
    paths,
  });
}

export async function recomputePlanAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({ orderId: id, planId: id }),
    input,
    execute: (actor, data) =>
      service.recomputePlan(actor, data.orderId, data.planId),
    paths,
  });
}
