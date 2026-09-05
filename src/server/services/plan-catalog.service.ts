import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withTx, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { Forbidden, NotFound, ValidationError } from "@/domain/errors";
import { INTERVALS, type Interval } from "@/domain/entitlements/effective";

export const TierInput = z.object({
  name: z.string().trim().min(1).max(100),
  rank: z.number().int().min(0).max(10000),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});
export const PlanInput = z.object({
  priceMinor: z.number().int().min(0).max(2147483647),
  prorationRule: z.enum(["DAILY", "NONE"]),
  cancellationRule: z.enum(["NONE", "PRORATED_CREDIT", "FULL_CREDIT"]),
  isActive: z.boolean(),
});
export const CycleInput = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ValidationError(result.error.issues[0].message);
  return result.data;
}
export function assertPlanAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN")
    throw new Forbidden("Only administrators can manage subscription plans.");
}
export async function lockProduct(tx: Tx, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plans:${productId}`}))`;
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.type !== "SUBSCRIPTION")
    throw new NotFound("Subscription product not found.");
  return product;
}
export async function auditCatalogue(
  tx: Tx,
  actor: SessionUser,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  await writeAudit(tx, {
    actorId: actor.id,
    actorType: "USER",
    entityType,
    entityId,
    action,
    before:
      before == null
        ? undefined
        : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
    after:
      after == null
        ? undefined
        : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
    reason,
  });
}
export async function createTier(
  actor: SessionUser,
  productId: string,
  input: z.input<typeof TierInput>,
) {
  assertPlanAdmin(actor);
  const data = parseInput(TierInput, input);
  return withTx(async (tx) => {
    await lockProduct(tx, productId);
    const row = await tx.planTier.create({ data: { ...data, productId } });
    await auditCatalogue(
      tx,
      actor,
      "PlanTier",
      row.id,
      "TIER.CREATED",
      null,
      row,
    );
    return row;
  });
}
export async function updateTier(
  actor: SessionUser,
  tierId: string,
  input: z.input<typeof TierInput>,
) {
  assertPlanAdmin(actor);
  const data = parseInput(TierInput, input);
  return withTx(async (tx) => {
    const initial = await tx.planTier.findUnique({ where: { id: tierId } });
    if (!initial) throw new NotFound("Tier not found.");
    await lockProduct(tx, initial.productId);
    const before = await tx.planTier.findUniqueOrThrow({
      where: { id: tierId },
    });
    if (
      data.isActive === false &&
      (await tx.subscription.count({
        where: {
          plan: { tierId },
          status: { in: ["SCHEDULED", "ACTIVE", "PAUSE_SCHEDULED", "PAUSED"] },
        },
      }))
    )
      throw new ValidationError("This tier still has current subscribers.");
    const row = await tx.planTier.update({ where: { id: tierId }, data });
    if (data.isActive === false)
      await tx.subscriptionPlan.updateMany({
        where: { tierId },
        data: { isActive: false },
      });
    await auditCatalogue(
      tx,
      actor,
      "PlanTier",
      tierId,
      "TIER.UPDATED",
      before,
      row,
    );
    return row;
  });
}
export async function deactivateTier(actor: SessionUser, tierId: string) {
  assertPlanAdmin(actor);
  return withTx(async (tx) => {
    const initial = await tx.planTier.findUnique({ where: { id: tierId } });
    if (!initial) throw new NotFound("Tier not found.");
    await lockProduct(tx, initial.productId);
    const before = await tx.planTier.findUniqueOrThrow({
      where: { id: tierId },
    });
    if (
      await tx.subscription.count({
        where: {
          plan: { tierId },
          status: { in: ["SCHEDULED", "ACTIVE", "PAUSE_SCHEDULED", "PAUSED"] },
        },
      })
    )
      throw new ValidationError("This tier still has current subscribers.");
    const row = await tx.planTier.update({
      where: { id: tierId },
      data: { isActive: false },
    });
    await tx.subscriptionPlan.updateMany({
      where: { tierId },
      data: { isActive: false },
    });
    await auditCatalogue(
      tx,
      actor,
      "PlanTier",
      tierId,
      "TIER.DEACTIVATED",
      before,
      row,
    );
    return row;
  });
}
async function savePlan(
  tx: Tx,
  actor: SessionUser,
  tier: { id: string; productId: string; name: string; isActive: boolean },
  interval: Interval,
  data: z.output<typeof PlanInput>,
) {
  if (data.isActive && !tier.isActive)
    throw new ValidationError(
      "Reactivate the tier before activating its plans.",
    );
  const where = { tierId_interval: { tierId: tier.id, interval } };
  const before = await tx.subscriptionPlan.findUnique({ where });
  const row = await tx.subscriptionPlan.upsert({
    where,
    update: data,
    create: {
      ...data,
      tierId: tier.id,
      productId: tier.productId,
      interval,
      name: `${tier.name} ${interval.toLowerCase()}`,
    },
  });
  await auditCatalogue(
    tx,
    actor,
    "SubscriptionPlan",
    row.id,
    "PLAN.SAVED",
    before,
    row,
  );
  return row;
}
export async function upsertPlanForTierCycle(
  actor: SessionUser,
  tierId: string,
  interval: Interval,
  input: z.input<typeof PlanInput>,
) {
  assertPlanAdmin(actor);
  const data = parseInput(PlanInput, input);
  parseInput(CycleInput, interval);
  return withTx(async (tx) => {
    const tier = await tx.planTier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFound("Tier not found.");
    await lockProduct(tx, tier.productId);
    const current = await tx.planTier.findUniqueOrThrow({
      where: { id: tierId },
    });
    return savePlan(tx, actor, current, interval, data);
  });
}
export async function deactivatePlan(actor: SessionUser, planId: string) {
  assertPlanAdmin(actor);
  return withTx(async (tx) => {
    const initial = await tx.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!initial?.tierId) throw new NotFound("Tier plan not found.");
    await lockProduct(tx, initial.productId);
    const before = await tx.subscriptionPlan.findUniqueOrThrow({
      where: { id: planId },
    });
    const row = await tx.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });
    await auditCatalogue(
      tx,
      actor,
      "SubscriptionPlan",
      planId,
      "PLAN.DEACTIVATED",
      before,
      row,
    );
    return row;
  });
}
export async function copyPricesAcrossCycles(
  actor: SessionUser,
  tierId: string,
  fromInterval: Interval,
  discountPercent = 0,
) {
  assertPlanAdmin(actor);
  parseInput(CycleInput, fromInterval);
  parseInput(z.number().min(0).max(100), discountPercent);
  return withTx(async (tx) => {
    const tier = await tx.planTier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFound("Tier not found.");
    await lockProduct(tx, tier.productId);
    const source = await tx.subscriptionPlan.findUnique({
      where: { tierId_interval: { tierId, interval: fromInterval } },
    });
    if (!source)
      throw new ValidationError("Save the source cycle price first.");
    const currentTier = await tx.planTier.findUniqueOrThrow({
      where: { id: tierId },
    });
    const yearlyUnits = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 };
    for (const interval of INTERVALS.filter((i) => i !== fromInterval)) {
      const data = parseInput(PlanInput, {
        ...source,
        priceMinor: Math.round(
          ((source.priceMinor * yearlyUnits[fromInterval]) /
            yearlyUnits[interval]) *
            (1 - discountPercent / 100),
        ),
      });
      await savePlan(tx, actor, currentTier, interval, data);
    }
  });
}
