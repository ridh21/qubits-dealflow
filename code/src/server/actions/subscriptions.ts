"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAction } from "./run-action";
import * as billing from "@/server/services/subscription-billing.service";
import { changePause } from "@/server/services/pause-resume.service";
import { runBilling } from "@/server/services/billing-job";
const roles = ["ADMIN", "FINANCE"];
const id = z.string().min(1).max(200);
const base = z.object({ id });
const change = base.extend({
  newQty: z.number().int().positive().max(1000000),
  newPlanId: id,
});
const mode = z.enum(["END_OF_PERIOD", "IMMEDIATE"]);
const key = z.string().uuid();
function refresh(id: string) {
  revalidatePath(`/subscriptions/${id}`);
  revalidatePath("/subscriptions");
  revalidatePath("/invoices");
  revalidatePath("/fulfillment");
}
export async function previewChangeAction(input: unknown) {
  return runAction({
    roles,
    schema: change,
    input,
    execute: (_, data) => billing.previewChange(data.id, data),
  });
}
export async function previewCancelAction(input: unknown) {
  return runAction({
    roles,
    schema: base.extend({ mode }),
    input,
    execute: (_, data) => billing.previewCancel(data.id, data.mode),
  });
}
export async function modifySubscriptionAction(input: unknown) {
  return runAction({
    roles,
    schema: change.extend({ idempotencyKey: key }),
    input,
    execute: async (actor, data) => {
      await billing.changeSubscription(actor, data.id, data);
      refresh(data.id);
    },
  });
}
export async function cancelSubscriptionAction(input: unknown) {
  return runAction({
    roles,
    schema: base.extend({
      mode,
      reason: z.string().trim().min(1, "Add a cancellation reason.").max(1000),
      idempotencyKey: key,
    }),
    input,
    execute: async (actor, data) => {
      await billing.cancelSubscription(actor, data.id, data);
      refresh(data.id);
    },
  });
}
export async function activationAction(input: unknown) {
  return runAction({
    roles,
    schema: base.extend({ date: z.iso.datetime() }),
    input,
    execute: async (actor, data) => {
      await billing.setActivationDate(actor, data.id, new Date(data.date));
      refresh(data.id);
    },
  });
}
export async function pauseResumeAction(input: unknown) {
  return runAction({
    roles,
    schema: base.extend({
      action: z.enum(["PAUSE", "WITHDRAW", "RESUME"]),
      requestedDate: z.iso.datetime().optional(),
      idempotencyKey: key,
    }),
    input,
    execute: async (actor, data) => {
      await changePause(actor, data.id, {
        ...data,
        requestedDate: data.requestedDate
          ? new Date(data.requestedDate)
          : undefined,
      });
      refresh(data.id);
    },
  });
}
export async function runBillingAction() {
  return runAction({
    roles,
    schema: z.object({}),
    input: {},
    execute: async () => {
      const result = await runBilling();
      revalidatePath("/subscriptions", "layout");
      revalidatePath("/invoices", "layout");
      return result;
    },
  });
}
