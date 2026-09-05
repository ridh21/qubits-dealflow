import { Prisma } from "@prisma/client";
import type { DbClient } from "@/server/db";
import { POLICY_DEFAULTS, PolicyKindZ } from "../../src/domain/policy/schemas";
import { parsePolicy } from "../../src/domain/policy/validate-discount-risk";
/** Run after catalogue seed. Never replaces an administrator's published configuration. */
export async function seedPolicy(prisma: DbClient) {
  const categories = await prisma.category.findMany();
  const categoryCeilingsBp = Object.fromEntries(
    categories.map((c) => [
      c.id,
      c.name === "Hardware" ? 1500 : c.name === "Services" ? 1000 : 0,
    ]),
  );
  for (const kind of PolicyKindZ.options)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`policy:${kind}`}))`;
      if (await tx.policyVersion.count({ where: { kind } })) return;
      const payload = parsePolicy(
        kind,
        kind === "DISCOUNT_RISK"
          ? { ...POLICY_DEFAULTS[kind], categoryCeilingsBp }
          : POLICY_DEFAULTS[kind],
      );
      const row = await tx.policyVersion.create({
        data: {
          kind,
          version: 1,
          payload: payload as Prisma.InputJsonValue,
          isActive: true,
          reason: "Initial PRD policy defaults",
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          entityType: "PolicyVersion",
          entityId: row.id,
          action: "POLICY.PUBLISHED",
          version: 1,
          after: { payload: payload as Prisma.InputJsonValue },
          reason: "Initial PRD policy defaults",
        },
      });
    });
}
