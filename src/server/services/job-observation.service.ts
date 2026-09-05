import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { DomainError } from "@/domain/errors";

export const JOB_ENTITY = "BillingRun";
export const JOB_STARTED = "BILLING.RUN_STARTED";
export const JOB_FINISHED = "BILLING.RUN_FINISHED";
export const JOB_FAILURE = "BILLING.RUN_FAILURE";
export const FailureSchema = z.object({
  id: z.string().max(200),
  scope: z.enum(["ORDER", "SUBSCRIPTION", "ORDER_DISCOVERY", "SUBSCRIPTION_DISCOVERY", "RUN"]),
  code: z.string().max(40),
  message: z.string().max(300),
});
export type JobFailure = z.infer<typeof FailureSchema>;
export const StartSchema = z.object({
  asOf: z.iso.datetime(),
  trigger: z.enum(["SYSTEM", "API", "ADMIN_RETRY"]),
  retryOf: z.uuid().nullable(),
});
export const OutcomeSchema = z.object({
  status: z.enum(["SUCCEEDED", "PARTIAL_FAILURE", "FAILED"]),
  ordersStarted: z.number().int().nonnegative(),
  invoices: z.number().int().nonnegative(),
  transitions: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  observationFailures: z.number().int().nonnegative(),
  failures: z.array(FailureSchema).max(100),
});
export type BillingOutcome = z.infer<typeof OutcomeSchema>;
export type BillingRunContext = {
  runId: string;
  actorId?: string;
  asOf: string;
  trigger: z.infer<typeof StartSchema>["trigger"];
  retryOf: string | null;
};
export type BillingRunOptions = Pick<Partial<BillingRunContext>, "actorId" | "trigger" | "retryOf">;

const descriptions: Record<string, string> = {
  CONFIGURATION: "Billing configuration is missing or invalid. Review the billing policy.",
  VALIDATION: "The billing record needs attention before it can be processed.",
  CONFLICT: "The record changed during billing. Retry the run.",
  NOT_FOUND: "A required billing record no longer exists.",
  FORBIDDEN: "The operation was not permitted.",
  CATCH_UP_LIMIT: "The catch-up limit was reached. Retry to continue remaining periods.",
  DATABASE: "The database operation failed. Check database availability and retry.",
  UNEXPECTED: "Billing could not process this item. Investigate using the correlation ID, then retry.",
};
/** Never copy exception messages, stacks, queries, metadata or connection strings. */
export function safeJobFailure(error: unknown, scope: JobFailure["scope"], id: string): JobFailure {
  const candidate = error && typeof error === "object" && "code" in error ? error.code : null;
  const code = error instanceof DomainError && Object.hasOwn(descriptions, error.code)
    ? error.code
    : typeof candidate === "string" && /^P\d{4}$/.test(candidate)
      ? candidate
      : candidate === "CATCH_UP_LIMIT" ? "CATCH_UP_LIMIT" : "UNEXPECTED";
  return { id: id.slice(0, 200), scope, code, message: descriptions[code] ?? descriptions.DATABASE };
}
export function logJobEvent(event: string, runId: string, failure?: JobFailure) {
  console.error(JSON.stringify({ event, correlationId: runId, ...(failure ? {
    scope: failure.scope, entityId: failure.id, code: failure.code,
  } : {}) }));
}
export class JobObservationError extends DomainError {
  constructor(readonly runId: string) {
    super("CONFIGURATION", `Billing observation could not be saved. Check job history before retrying. Correlation ID: ${runId}`);
  }
}
export async function startBillingObservation(now: Date, options: BillingRunOptions = {}): Promise<BillingRunContext> {
  const run: BillingRunContext = {
    runId: randomUUID(), actorId: options.actorId, asOf: now.toISOString(),
    trigger: options.trigger ?? "SYSTEM", retryOf: options.retryOf ?? null,
  };
  try {
    await writeAudit(prisma, {
      actorId: run.actorId, actorType: run.actorId ? "USER" : "SYSTEM",
      entityType: JOB_ENTITY, entityId: run.runId, action: JOB_STARTED,
      after: { asOf: run.asOf, trigger: run.trigger, retryOf: run.retryOf },
    });
  } catch {
    logJobEvent("billing.observation_start_failed", run.runId);
    throw new JobObservationError(run.runId);
  }
  return run;
}
export async function recordBillingFailure(run: BillingRunContext, failure: JobFailure): Promise<boolean> {
  logJobEvent("billing.item_failed", run.runId, failure);
  try {
    await writeAudit(prisma, {
      actorId: run.actorId, actorType: run.actorId ? "USER" : "SYSTEM",
      entityType: JOB_ENTITY, entityId: run.runId, action: JOB_FAILURE,
      after: failure, reason: failure.message,
    });
    return true;
  } catch {
    logJobEvent("billing.failure_observation_failed", run.runId, failure);
    return false;
  }
}
export async function finishBillingObservation(run: BillingRunContext, outcome: BillingOutcome) {
  try {
    await writeAudit(prisma, {
      actorId: run.actorId, actorType: run.actorId ? "USER" : "SYSTEM",
      entityType: JOB_ENTITY, entityId: run.runId, action: JOB_FINISHED,
      after: outcome,
    });
  } catch {
    logJobEvent("billing.observation_finish_failed", run.runId);
    throw new JobObservationError(run.runId);
  }
}
