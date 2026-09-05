"use server";
import { z } from "zod";
import { runAction } from "./run-action";
import {
  actOnAlert,
  runDetectors,
} from "@/server/services/deal-health.service";
import { expireQuotations } from "@/server/services/quotation.service";
const roles = ["ADMIN", "SALES_MANAGER", "FINANCE"];
export async function healthAlertAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      id: z.string().min(1),
      action: z.enum(["NUDGE", "ESCALATE", "RESOLVE"]),
      note: z.string().trim().min(1).max(2000),
    }),
    input,
    execute: (actor, data) =>
      actOnAlert(actor, data.id, data.action, data.note),
    paths: ["/deal-health", "/dashboard"],
  });
}
export async function scanHealthAction() {
  return runAction({
    roles,
    schema: z.object({}),
    input: {},
    execute: async () => {
      const now = new Date();
      await expireQuotations(now);
      return runDetectors(now);
    },
    paths: ["/deal-health", "/dashboard"],
  });
}
