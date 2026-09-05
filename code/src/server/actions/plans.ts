"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/domain/errors";
import * as catalog from "@/server/services/plan-catalog.service";
import type { Interval } from "@/domain/entitlements/effective";
import type { z } from "zod";
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/admin/plans", "layout");
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
export async function createTierAction(
  productId: string,
  input: z.input<typeof catalog.TierInput>,
) {
  return run(async () =>
    catalog.createTier(await requireAdmin(), productId, input),
  );
}
export async function updateTierAction(
  tierId: string,
  input: z.input<typeof catalog.TierInput>,
) {
  return run(async () =>
    catalog.updateTier(await requireAdmin(), tierId, input),
  );
}
export async function deactivateTierAction(tierId: string) {
  return run(async () => catalog.deactivateTier(await requireAdmin(), tierId));
}
export async function savePlanAction(
  tierId: string,
  interval: Interval,
  input: z.input<typeof catalog.PlanInput>,
) {
  return run(async () =>
    catalog.upsertPlanForTierCycle(
      await requireAdmin(),
      tierId,
      interval,
      input,
    ),
  );
}
export async function copyPricesAction(
  tierId: string,
  interval: Interval,
  discount: number,
) {
  return run(async () =>
    catalog.copyPricesAcrossCycles(
      await requireAdmin(),
      tierId,
      interval,
      discount,
    ),
  );
}
