import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { writeAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/guards";
import {
  ConfigurationError,
  Conflict,
  Forbidden,
  NotFound,
  ValidationError,
} from "@/domain/errors";
import {
  canPublishPolicy,
  PolicyKindZ,
  type PolicyKind,
  type PolicyPayload,
} from "@/domain/policy/schemas";
import { parsePolicy } from "@/domain/policy/validate-discount-risk";
import { diffPolicy } from "@/domain/policy/diff";
export { simulateDiscountRisk } from "@/domain/risk/evaluate";

export interface ActivePolicy<K extends PolicyKind> {
  id: string;
  version: number;
  payload: PolicyPayload<K>;
}
/** Pass the caller's transaction during submission so the evaluated version is snapshotted atomically. */
export async function getActivePolicy<K extends PolicyKind>(
  db: Pick<Tx, "policyVersion">,
  kind: K,
): Promise<ActivePolicy<K>> {
  const rows = await db.policyVersion.findMany({
    where: { kind, isActive: true },
    take: 2,
  });
  if (rows.length !== 1)
    throw new ConfigurationError(
      rows.length
        ? "Multiple active policies. Ask an administrator to repair configuration."
        : `Publish a ${kind} policy before continuing.`,
      { code: rows.length ? "POLICY_AMBIGUOUS" : "POLICY_MISSING", kind },
    );
  const row = rows[0];
  return {
    id: row.id,
    version: row.version,
    payload: parsePolicy(kind, row.payload),
  };
}
export const getCachedActivePolicy = cache(<K extends PolicyKind>(kind: K) =>
  getActivePolicy(prisma, kind),
);
export async function getPolicyVersion(
  id: string,
  db: Pick<Tx, "policyVersion"> = prisma,
) {
  const row = await db.policyVersion.findUnique({ where: { id } });
  if (!row) throw new NotFound("That policy version no longer exists.");
  return { ...row, payload: parsePolicy(row.kind, row.payload) };
}
export async function listPolicyHistory(
  kind: PolicyKind,
  params: { page?: number; pageSize?: number; q?: string } = {},
) {
  const page = Math.max(1, Math.floor(params.page || 1)),
    pageSize = Math.min(50, Math.max(1, Math.floor(params.pageSize || 20)));
  const where: Prisma.PolicyVersionWhereInput = {
    kind,
    ...(params.q
      ? { reason: { contains: params.q.slice(0, 200), mode: "insensitive" } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.policyVersion.findMany({
      where,
      orderBy: { version: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.policyVersion.count({ where }),
  ]);
  const authors = await prisma.user.findMany({
    where: {
      id: {
        in: rows.flatMap((r) => (r.publishedById ? [r.publishedById] : [])),
      },
    },
    select: { id: true, name: true },
  });
  return {
    rows: rows.map((r) => ({
      ...r,
      publishedByName:
        authors.find((a) => a.id === r.publishedById)?.name ?? "System",
    })),
    total,
    page,
    pageSize,
  };
}
/** Authorization is enforced here as well as at the action boundary. JSON rules are immutable snapshots. */
export async function publishPolicy(
  actor: SessionUser,
  kind: PolicyKind,
  input: unknown,
  reason: string,
  expectedActiveId?: string | null,
) {
  if (!PolicyKindZ.safeParse(kind).success)
    throw new ValidationError("Choose a valid policy kind.");
  if (!canPublishPolicy(actor.role, kind))
    throw new Forbidden(
      "Only administrators can publish this policy. Sales managers may publish discount and risk policies.",
    );
  if (
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.trim().length > 1000
  )
    throw new ValidationError(
      "Enter a publication reason (1–1,000 characters).",
    );
  const payload = parsePolicy(kind, input);
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Also serializes the first publication when no PolicyVersion row exists yet.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`policy:${kind}`}))`;
        const latest = await tx.policyVersion.findFirst({
          where: { kind },
          orderBy: { version: "desc" },
        });
        const active = await tx.policyVersion.findFirst({
          where: { kind, isActive: true },
        });
        if (
          expectedActiveId !== undefined &&
          (active?.id ?? null) !== expectedActiveId
        )
          throw new Conflict(
            "A newer policy was published. Reload and review your changes before publishing.",
          );
        if (kind === "DISCOUNT_RISK") {
          const discount = payload as PolicyPayload<"DISCOUNT_RISK">;
          const categories = await tx.category.findMany({
            select: { id: true, name: true },
          });
          const missing = categories.filter(
            (c) => discount.categoryCeilingsBp[c.id] === undefined,
          );
          if (missing.length)
            throw new ValidationError(
              `Set category ceilings for ${missing.map((c) => c.name).join(", ")}.`,
            );
        }
        if (kind === "RECOMMENDATION") {
          const p = payload as PolicyPayload<"RECOMMENDATION">;
          const ids = [
            ...new Set([
              ...Object.keys(p.promotions),
              ...p.rules.flatMap((r) => [r.productId, r.suggestedProductId]),
            ]),
          ];
          if (
            (await tx.product.count({ where: { id: { in: ids } } })) !==
            ids.length
          )
            throw new ValidationError(
              "A selected product no longer exists. Refresh the product rules.",
            );
        }
        await tx.policyVersion.updateMany({
          where: { kind, isActive: true },
          data: { isActive: false },
        });
        const row = await tx.policyVersion.create({
          data: {
            kind,
            version: (latest?.version ?? 0) + 1,
            payload: payload as Prisma.InputJsonValue,
            isActive: true,
            publishedById: actor.id,
            reason: reason.trim(),
          },
        });
        await writeAudit(tx, {
          actorId: actor.id,
          actorType: "USER",
          entityType: "PolicyVersion",
          entityId: row.id,
          action: "POLICY.PUBLISHED",
          version: row.version,
          before: active?.payload ?? undefined,
          after: {
            payload: payload as Prisma.InputJsonValue,
            diff: diffPolicy(
              active?.payload ?? null,
              payload,
            ) as unknown as Prisma.InputJsonValue,
            previousVersionId: active?.id ?? null,
          },
          reason: reason.trim(),
        });
        return row;
      },
      { timeout: 15000 },
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(e.code)
    )
      throw new Conflict(
        "Another policy publication completed. Reload and try again.",
      );
    throw e;
  }
}
export async function restoreAsNewVersion(
  actor: SessionUser,
  versionId: string,
  reason: string,
  expectedActiveId?: string | null,
) {
  const version = await getPolicyVersion(versionId);
  return publishPolicy(
    actor,
    version.kind,
    version.payload,
    reason,
    expectedActiveId,
  );
}
