"use server";
import { revalidatePath } from "next/cache";
import { requireQuotationCustomer } from "@/domain/quotation/require-customer";
import { requireInternal, requireAdmin } from "@/server/auth/guards";
import {
  toActionError,
  type ActionResult,
  ValidationError,
} from "@/domain/errors";
import { type PolicyKind } from "@/domain/policy/schemas";
import { parsePolicy } from "@/domain/policy/validate-discount-risk";
import {
  publishPolicy,
  restoreAsNewVersion,
} from "@/server/services/policy.service";
import { prisma } from "@/server/db";
import {
  computeCopurchasePairs,
  previewRecommendations,
} from "@/domain/policy/recommendations";
import { simulateFulfillment } from "@/domain/policy/simulate-fulfillment";
import { simulateDiscountRisk, type SimInput } from "@/domain/risk/evaluate";
import {
  getFulfillmentSample,
  getPolicySampleQuote,
  getRecommendationSample,
  listPolicySampleQuotes,
} from "@/server/queries/policy";
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toActionError(e);
  }
}
export async function publishPolicyAction(
  kind: PolicyKind,
  payload: unknown,
  reason: string,
  expectedActiveId: string | null,
) {
  return run(async () => {
    const row = await publishPolicy(
      await requireInternal(),
      kind,
      payload,
      reason,
      expectedActiveId,
    );
    revalidatePath("/admin/policy", "layout");
    return { id: row.id, version: row.version };
  });
}
export async function restorePolicyAction(
  versionId: string,
  reason: string,
  expectedActiveId: string | null,
) {
  return run(async () => {
    const row = await restoreAsNewVersion(
      await requireInternal(),
      versionId,
      reason,
      expectedActiveId,
    );
    revalidatePath("/admin/policy", "layout");
    return { id: row.id, version: row.version };
  });
}
export async function listPolicyQuotesAction(query: string) {
  return run(async () =>
    listPolicySampleQuotes(await requireInternal(), query),
  );
}
export async function loadRiskSampleAction(quoteId: string) {
  return run(async (): Promise<SimInput> => {
    const quote = await getPolicySampleQuote(await requireInternal(), quoteId);
    // Simulation is tier-driven, so an unassigned draft cannot be a sample.
    const customer = requireQuotationCustomer(quote);
    return {
      tier: customer.tier,
      orderDiscountBp: quote.orderDiscountBp,
      lines: quote.lines.map((l) => ({
        id: l.id,
        categoryId: l.categoryId,
        baseMinor: l.qty * l.unitPriceMinor,
        discountBp: l.discountBp,
        cycle: l.interval ?? "ONE_TIME",
      })),
    };
  });
}
export async function simulateRiskAction(payload: unknown, sample: SimInput) {
  return run(async () => {
    await requireInternal();
    return simulateDiscountRisk(parsePolicy("DISCOUNT_RISK", payload), sample);
  });
}
export async function simulateFulfillmentAction(
  payload: unknown,
  quoteId: string,
) {
  return run(async () => {
    const actor = await requireInternal(),
      p = parsePolicy("FULFILLMENT", payload);
    const sample = await getFulfillmentSample(actor, quoteId);
    if (!p.allowPreviewBeforeConfirmation && !sample.confirmed)
      throw new ValidationError(
        "This policy permits previews only after confirmation.",
      );
    return simulateFulfillment(p, sample.lines, sample.warehouses);
  });
}
export async function previewRecommendationsAction(
  payload: unknown,
  quoteId: string,
) {
  return run(async () => {
    const actor = await requireInternal(),
      p = parsePolicy("RECOMMENDATION", payload),
      sample = await getRecommendationSample(actor, quoteId);
    return previewRecommendations(p, sample.productIds, sample.products);
  });
}
/** Read-only refresh; relationships are staged in the editor and become active only on publication. */
export async function refreshCopurchaseRulesAction() {
  return run(async () => {
    await requireAdmin();
    const orders = await prisma.order.findMany({
      where: { quotation: { status: "CONFIRMED" } },
      select: { lines: { select: { productId: true } } },
    });
    return computeCopurchasePairs(
      orders.map((o) => ({ productIds: o.lines.map((l) => l.productId) })),
    );
  });
}
