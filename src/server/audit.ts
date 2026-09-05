import type { Tx } from "./db";
import type { Prisma } from "@prisma/client";

export type ActorType = "USER" | "CUSTOMER" | "SYSTEM";

export interface AuditInput {
  actorId?: string | null;
  actorType: ActorType;
  entityType: string;
  entityId: string;
  action: string;
  version?: number | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
}

/** Append-only. Every mutating service writes one row per affected entity. */
export async function writeAudit(tx: Tx, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      version: input.version ?? null,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      reason: input.reason ?? null,
    },
  });
}
