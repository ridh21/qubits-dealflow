"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/domain/errors";
import * as service from "@/server/services/entitlement.service";
import { listPlanNoticeHistory } from "@/server/queries/plans";
import type { Interval } from "@/domain/entitlements/effective";
import type { z } from "zod";
async function run<T>(
  fn: () => Promise<T>,
  refresh = true,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (refresh) revalidatePath("/admin/plans", "layout");
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}
export async function saveDefinitionAction(
  productId: string,
  id: string | null,
  input: z.input<typeof service.DefinitionInput>,
) {
  return run(async () => {
    const actor = await requireAdmin();
    return id
      ? service.updateEntitlementDefinition(actor, productId, id, input)
      : service.defineEntitlement(actor, productId, input);
  });
}
export async function archiveDefinitionAction(productId: string, id: string) {
  return run(async () =>
    service.archiveEntitlement(await requireAdmin(), productId, id),
  );
}
export async function saveEntitlementValueAction(
  definitionId: string,
  tierId: string,
  interval: Interval | null,
  value: unknown,
) {
  return run(async () => {
    const actor = await requireAdmin();
    return interval
      ? service.setOverride(actor, definitionId, tierId, interval, value)
      : service.setTierDefault(actor, definitionId, tierId, value);
  });
}
export async function resetOverrideAction(
  definitionId: string,
  tierId: string,
  interval: Interval,
) {
  return run(async () =>
    service.resetOverride(await requireAdmin(), definitionId, tierId, interval),
  );
}
export async function previewPublishAction(productId: string) {
  return run(
    async () => service.previewPublish(await requireAdmin(), productId),
    false,
  );
}
export async function publishChangesAction(
  productId: string,
  reason: string,
  revision: string,
) {
  return run(async () =>
    service.publishChanges(await requireAdmin(), productId, reason, revision),
  );
}
export async function discardDraftAction(productId: string) {
  return run(async () =>
    service.discardEntitlementDraft(await requireAdmin(), productId),
  );
}
export async function noticeHistoryAction(
  productId: string,
  filters: Parameters<typeof listPlanNoticeHistory>[1],
) {
  return run(async () => listPlanNoticeHistory(productId, filters), false);
}
