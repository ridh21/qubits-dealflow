"use server";
import { z } from "zod";
import { runAction } from "./run-action";
import { respondToProposal } from "@/server/services/negotiation.service";
import { sendToCustomer } from "@/server/services/portal.service";
const roles = ["ADMIN", "SALES_MANAGER", "SALES_REP"];
export async function sendToCustomerAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      id: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }),
    input,
    execute: (actor, data) =>
      sendToCustomer(actor, data.id, data.expectedVersion),
    paths: ["/quotations", "/portal"],
  });
}
export async function respondToProposalAction(input: unknown) {
  return runAction({
    roles,
    schema: z.object({
      messageId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      decision: z.enum(["APPLY", "DECLINE"]),
      reply: z.string().trim().min(1).max(2000),
    }),
    input,
    execute: (actor, data) =>
      respondToProposal(
        actor,
        data.messageId,
        data.decision,
        data.reply,
        data.expectedVersion,
      ),
    paths: ["/quotations", "/portal", "/approvals"],
  });
}
