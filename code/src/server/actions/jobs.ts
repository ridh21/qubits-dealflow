"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/guards";
import { DomainError, type ActionResult } from "@/domain/errors";
import { getBillingRun } from "@/server/queries/jobs";
import { runBilling } from "@/server/services/billing-job";
import { logJobEvent } from "@/server/services/job-observation.service";
import { randomUUID } from "node:crypto";

export async function retryBillingRunAction(input: unknown): Promise<ActionResult<{ runId: string; status: string }>> {
  const correlationId = randomUUID();
  try {
    const actor = await requireAdmin();
    const parsed = z.object({ runId: z.uuid() }).strict().safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "Choose a recorded billing run." } };
    const previous = await getBillingRun(parsed.data.runId);
    if (!previous.canRetry || !previous.asOf)
      return { ok: false, error: { code: "CONFLICT", message: "Only completed runs with failures can be retried. Refresh job history." } };
    // Retry the recorded cutoff, never a browser-supplied date or the current date.
    // The full scan also recovers failed discovery; existing source keys prevent rebilling.
    const result = await runBilling(new Date(previous.asOf), {
      trigger: "ADMIN_RETRY", actorId: actor.id, retryOf: previous.runId,
    });
    revalidatePath("/admin/jobs");
    revalidatePath("/subscriptions", "layout");
    revalidatePath("/invoices", "layout");
    return { ok: true, data: { runId: result.runId, status: result.status } };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, error: { code: error.code, message: error.message } };
    // Shared action mapping logs raw exceptions; this boundary must not do that.
    logJobEvent("billing.retry_action_failed", correlationId);
    return { ok: false, error: { code: "UNEXPECTED", message: `Retry could not complete. Refresh job history. Correlation ID: ${correlationId}` } };
  }
}
