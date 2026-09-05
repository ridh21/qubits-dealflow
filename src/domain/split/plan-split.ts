import { ValidationError } from "../errors";
export interface SplitLine {
  orderLineId: string;
  productId: string;
  qty: number;
  isPhysical: boolean;
}
export interface WarehouseStock {
  warehouseId: string;
  code: string;
  name: string;
  fixedShipmentCostMinor: number;
  shippingCostWeightMinor: number;
  priority: number;
  available: Record<string, number>;
}
export interface SplitPolicy {
  shipmentCountPenaltyMinor: number;
  maxWarehousesPerOrder: number;
  tieBreak: "PRIORITY" | "CODE";
}
export interface SplitPlan {
  allocations: {
    orderLineId: string;
    productId: string;
    warehouseId: string;
    qty: number;
  }[];
  backorders: { orderLineId: string; productId: string; qty: number }[];
  shipments: number;
  estimatedCostMinor: number;
  objectiveMinor: number;
  warehousesUsed: string[];
  rationale: string[];
  method: "EXHAUSTIVE" | "GREEDY";
}
export function planSplit(
  input: SplitLine[],
  warehouses: WarehouseStock[],
  policy: SplitPolicy,
): SplitPlan {
  const lines = input.filter((l) => l.isPhysical);
  if (
    lines.some((l) => !Number.isInteger(l.qty) || l.qty < 0) ||
    policy.maxWarehousesPerOrder < 1
  )
    throw new ValidationError(
      "Invalid allocation quantities or warehouse limit.",
    );
  const tie = (a: WarehouseStock, b: WarehouseStock) =>
    (policy.tieBreak === "PRIORITY" ? a.priority - b.priority : 0) ||
    a.code.localeCompare(b.code);
  const ordered = [...warehouses].sort(tie),
    method =
      ordered.length <= 8 ? ("EXHAUSTIVE" as const) : ("GREEDY" as const);
  function evaluate(subset: WarehouseStock[]): SplitPlan {
    const available = new Map(
        subset.map((w) => [w.warehouseId, { ...w.available }]),
      ),
      allocations: SplitPlan["allocations"] = [],
      backorders: SplitPlan["backorders"] = [];
    // Unit shipping cost determines allocation within a chosen subset; priority resolves equal costs.
    const costOrder = [...subset].sort(
      (a, b) =>
        a.shippingCostWeightMinor - b.shippingCostWeightMinor || tie(a, b),
    );
    for (const line of lines) {
      let remaining = line.qty;
      for (const w of costOrder) {
        const stock = available.get(w.warehouseId)!;
        const qty = Math.min(
          remaining,
          Math.max(0, stock[line.productId] ?? 0),
        );
        if (qty) {
          allocations.push({ ...line, warehouseId: w.warehouseId, qty });
          stock[line.productId] -= qty;
          remaining -= qty;
        }
      }
      if (remaining)
        backorders.push({
          orderLineId: line.orderLineId,
          productId: line.productId,
          qty: remaining,
        });
    }
    const used = subset
        .filter((w) => allocations.some((a) => a.warehouseId === w.warehouseId))
        .sort(tie),
      cost = used.reduce(
        (s, w) =>
          s +
          w.fixedShipmentCostMinor +
          allocations
            .filter((a) => a.warehouseId === w.warehouseId)
            .reduce((s, a) => s + a.qty * w.shippingCostWeightMinor, 0),
        0,
      );
    return {
      allocations,
      backorders,
      shipments: used.length,
      estimatedCostMinor: cost,
      objectiveMinor: cost + policy.shipmentCountPenaltyMinor * used.length,
      warehousesUsed: used.map((w) => w.warehouseId),
      rationale: [
        `${allocations.reduce((s, a) => s + a.qty, 0)} units fulfilled across ${used.length} shipments.`,
        `${backorders.reduce((s, b) => s + b.qty, 0)} units remain on backorder.`,
        ...(method === "GREEDY"
          ? [
              "Greedy selection for more than eight warehouses; optimality is not guaranteed.",
            ]
          : []),
      ],
      method,
    };
  }
  let best = evaluate([]);
  function compare(candidate: SplitPlan) {
    const fulfilled = (p: SplitPlan) =>
      p.allocations.reduce((s, a) => s + a.qty, 0);
    const difference = fulfilled(candidate) - fulfilled(best);
    if (
      difference > 0 ||
      (difference === 0 && candidate.objectiveMinor < best.objectiveMinor)
    )
      best = candidate;
  }
  if (method === "EXHAUSTIVE") {
    for (let mask = 1; mask < 2 ** ordered.length; mask++) {
      const subset = ordered.filter((_, i) => mask & (1 << i));
      if (subset.length <= policy.maxWarehousesPerOrder)
        compare(evaluate(subset));
    }
  } else {
    const selected: WarehouseStock[] = [];
    while (
      selected.length < Math.min(policy.maxWarehousesPerOrder, ordered.length)
    ) {
      let next: WarehouseStock | undefined, candidate: SplitPlan | undefined;
      for (const w of ordered.filter((w) => !selected.includes(w))) {
        const p = evaluate([...selected, w]);
        if (
          !candidate ||
          p.backorders.reduce((s, b) => s + b.qty, 0) <
            candidate.backorders.reduce((s, b) => s + b.qty, 0) ||
          (p.backorders.reduce((s, b) => s + b.qty, 0) ===
            candidate.backorders.reduce((s, b) => s + b.qty, 0) &&
            p.objectiveMinor < candidate.objectiveMinor)
        ) {
          candidate = p;
          next = w;
        }
      }
      if (!next || !candidate) break;
      selected.push(next);
      compare(candidate);
    }
  }
  return best;
}
export function checkLineInvariant(
  line: { qty: number; qtyShipped: number },
  allocations: { qty: number; qtyShipped: number; reserved: boolean }[],
  backorders: { qty: number; status: string }[],
) {
  return (
    line.qty ===
    line.qtyShipped +
      allocations
        .filter((a) => a.reserved)
        .reduce((s, a) => s + a.qty - a.qtyShipped, 0) +
      backorders
        .filter((b) => ["OPEN", "CONSOLIDATION_SUGGESTED"].includes(b.status))
        .reduce((s, b) => s + b.qty, 0)
  );
}
