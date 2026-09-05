import type { PolicyPayload } from "./schemas";
export interface FulfillmentWarehouse {
  id: string;
  code: string;
  priority: number;
  fixedShipmentCostMinor: number;
  shippingCostWeightMinor: number;
  available: Record<string, number>;
}
/** Deterministic greedy preview: coverage, then shipping + penalty, then configured tie-break.
 * Does not reserve stock and does not claim a globally optimal plan.
 */
export function simulateFulfillment(
  policy: PolicyPayload<"FULFILLMENT">,
  lines: readonly { productId: string; qty: number }[],
  warehouses: readonly FulfillmentWarehouse[],
) {
  const remaining: Record<string, number> = {};
  for (const l of lines)
    remaining[l.productId] = (remaining[l.productId] ?? 0) + l.qty;
  const candidates = [...warehouses],
    shipments: {
      warehouseId: string;
      code: string;
      costMinor: number;
      allocations: { productId: string; qty: number }[];
    }[] = [];
  while (candidates.length && shipments.length < policy.maxWarehousesPerOrder) {
    const ranked = candidates
      .map((w) => {
        const allocations = Object.entries(remaining)
          .map(([productId, qty]) => ({
            productId,
            qty: Math.min(qty, Math.max(0, w.available[productId] ?? 0)),
          }))
          .filter((l) => l.qty > 0);
        const coverage = allocations.reduce((s, l) => s + l.qty, 0);
        return {
          w,
          allocations,
          coverage,
          cost:
            w.fixedShipmentCostMinor +
            coverage * w.shippingCostWeightMinor +
            policy.shipmentCountPenaltyMinor,
        };
      })
      .sort(
        (a, b) =>
          b.coverage - a.coverage ||
          a.cost - b.cost ||
          (policy.tieBreak === "PRIORITY" ? a.w.priority - b.w.priority : 0) ||
          a.w.code.localeCompare(b.w.code) ||
          a.w.id.localeCompare(b.w.id),
      );
    const best = ranked[0];
    if (!best.coverage) break;
    shipments.push({
      warehouseId: best.w.id,
      code: best.w.code,
      costMinor: best.cost,
      allocations: best.allocations,
    });
    for (const l of best.allocations) remaining[l.productId] -= l.qty;
    candidates.splice(
      candidates.findIndex((w) => w.id === best.w.id),
      1,
    );
  }
  return {
    shipments,
    backorders: Object.entries(remaining)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty })),
    objectiveCostMinor: shipments.reduce((s, w) => s + w.costMinor, 0),
  };
}
