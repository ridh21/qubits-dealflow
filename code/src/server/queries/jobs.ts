import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { NotFound } from "@/domain/errors";
import {
  JOB_ENTITY, JOB_STARTED, JOB_FINISHED, JOB_FAILURE,
  StartSchema, OutcomeSchema, FailureSchema,
} from "@/server/services/job-observation.service";

const pageSize = 20;
type Entry = { entityId: string; after: unknown; createdAt: Date };
function project(start: Entry, finish?: Entry) {
  const input = StartSchema.safeParse(start.after);
  const outcome = OutcomeSchema.safeParse(finish?.after);
  return {
    runId: start.entityId, startedAt: start.createdAt.toISOString(),
    asOf: input.success ? input.data.asOf : null,
    trigger: input.success ? input.data.trigger : "UNKNOWN",
    retryOf: input.success ? input.data.retryOf : null,
    finishedAt: outcome.success && finish ? finish.createdAt.toISOString() : null,
    status: outcome.success ? outcome.data.status : "UNFINISHED" as const,
    outcome: outcome.success ? outcome.data : null,
    canRetry: input.success && outcome.success && outcome.data.status !== "SUCCEEDED",
  };
}
export async function listBillingRuns(requestedPage = 1) {
  await requireAdmin();
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10000, Math.floor(requestedPage))) : 1;
  const starts = await prisma.auditLog.findMany({
    where: { entityType: JOB_ENTITY, action: JOB_STARTED },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize, take: pageSize + 1,
    select: { entityId: true, after: true, createdAt: true },
  });
  const visible = starts.slice(0, pageSize);
  const finishes = visible.length ? await prisma.auditLog.findMany({
    where: { entityType: JOB_ENTITY, action: JOB_FINISHED, entityId: { in: visible.map((row) => row.entityId) } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, after: true, createdAt: true },
  }) : [];
  return {
    page, hasNext: starts.length > pageSize,
    rows: visible.map((row) => project(row, finishes.find((end) => end.entityId === row.entityId))),
  };
}
export async function getBillingRun(runId: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(runId).success) throw new NotFound("Billing run not found.");
  const rows = await prisma.auditLog.findMany({
    where: { entityType: JOB_ENTITY, entityId: runId, action: { in: [JOB_STARTED, JOB_FINISHED] } },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, action: true, after: true, createdAt: true },
  });
  const start = rows.find((row) => row.action === JOB_STARTED);
  if (!start) throw new NotFound("Billing run not found.");
  const result = project(start, rows.find((row) => row.action === JOB_FINISHED));
  // A completion contains a bounded fallback if individual failure audits failed.
  const failureRows = !result.outcome ? await prisma.auditLog.findMany({
    where: { entityType: JOB_ENTITY, entityId: runId, action: JOB_FAILURE },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
    select: { after: true },
  }) : [];
  const failures = result.outcome?.failures ?? failureRows.flatMap((row) => {
    const parsed = FailureSchema.safeParse(row.after);
    return parsed.success ? [parsed.data] : [];
  });
  return { ...result, failures };
}
