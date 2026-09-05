"use server";
import { z } from "zod";
import { runAction } from "./run-action";
import {
  QuoteVersionInput,
  QuoteReasonInput,
} from "@/lib/zod-schemas/quotation";
import { SALES_ROLES } from "@/server/services/quotation.service";
import {
  submitForApproval,
  decideStep,
  withdraw,
} from "@/server/services/approval.service";
const paths = ["/approvals", "/quotations", "/dashboard"];
export async function submitQuoteAction(input: unknown) {
  return runAction({
    roles: SALES_ROLES,
    schema: QuoteVersionInput,
    input,
    execute: (a, d) => submitForApproval(a, d.id, d.expectedVersion),
    paths,
  });
}
export async function withdrawQuoteAction(input: unknown) {
  return runAction({
    roles: SALES_ROLES,
    schema: QuoteReasonInput,
    input,
    execute: (a, d) => withdraw(a, d.id, d.expectedVersion, d.reason),
    paths,
  });
}
export async function decideApprovalAction(input: unknown) {
  return runAction({
    roles: ["ADMIN", "SALES_MANAGER", "FINANCE"],
    schema: z.object({
      stepId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
      note: z.string().max(1000).optional(),
    }),
    input,
    execute: (a, d) =>
      decideStep(a, d.stepId, d.decision, d.expectedVersion, d.note),
    paths,
  });
}
