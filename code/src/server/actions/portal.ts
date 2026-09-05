"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePortalCustomer, type SessionUser } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/domain/errors";
import {
  acceptQuotation,
  submitProposals,
  withdrawProposal,
  ProposalInput,
} from "@/server/services/negotiation.service";
import { changePause } from "@/server/services/pause-resume.service";

async function portalAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  execute: (actor: SessionUser, data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const actor = await requirePortalCustomer();
    const data = schema.parse(input);
    const result = await execute(actor, data);
    revalidatePath("/portal", "layout");
    revalidatePath("/quotations", "layout");
    revalidatePath("/subscriptions", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
const quote = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export async function acceptQuotationAction(input: unknown) {
  return portalAction(quote, input, (actor, data) =>
    acceptQuotation(actor, data.id, data.version),
  );
}
export async function submitProposalsAction(input: unknown) {
  return portalAction(
    quote.extend({ proposals: z.array(ProposalInput).min(1).max(30) }),
    input,
    (actor, data) =>
      submitProposals(actor, data.id, data.version, data.proposals),
  );
}
export async function withdrawProposalAction(input: unknown) {
  return portalAction(
    z.object({ messageId: z.string().min(1) }),
    input,
    (actor, data) => withdrawProposal(actor, data.messageId),
  );
}
export async function portalPauseAction(input: unknown) {
  return portalAction(
    z.object({
      id: z.string().min(1),
      action: z.enum(["PAUSE", "RESUME", "WITHDRAW"]),
      requestedDate: z.coerce.date().optional(),
      idempotencyKey: z.string().uuid(),
    }),
    input,
    (actor, data) => changePause(actor, data.id, data),
  );
}
