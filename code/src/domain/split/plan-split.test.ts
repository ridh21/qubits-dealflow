import { describe, it, expect } from "vitest";
import {
  planSplit,
  checkLineInvariant,
  type WarehouseStock,
} from "./plan-split";
const policy = {
  shipmentCountPenaltyMinor: 1500,
  maxWarehousesPerOrder: 3,
  tieBreak: "PRIORITY" as const,
};
const warehouses: WarehouseStock[] = [
  {
    warehouseId: "main",
    code: "MAIN",
    name: "Main",
    fixedShipmentCostMinor: 1200,
    shippingCostWeightMinor: 0,
    priority: 0,
    available: { laptop: 18 },
  },
  {
    warehouseId: "east",
    code: "EAST",
    name: "East",
    fixedShipmentCostMinor: 1700,
    shippingCostWeightMinor: 200,
    priority: 1,
    available: { laptop: 4 },
  },
];
const line = {
  orderLineId: "l",
  productId: "laptop",
  qty: 24,
  isPhysical: true,
};
describe("warehouse allocation", () => {
  it("matches scenario B", () => {
    const p = planSplit([line], warehouses, policy);
    expect(p.allocations.map((a) => a.qty)).toEqual([18, 4]);
    expect(p.backorders[0].qty).toBe(2);
    expect(p.estimatedCostMinor).toBe(3700);
    expect(p.objectiveMinor).toBe(6700);
  });
  it("shares stock across duplicate product lines", () => {
    const p = planSplit(
      [
        { ...line, qty: 15 },
        { ...line, orderLineId: "second", qty: 15 },
      ],
      warehouses,
      policy,
    );
    expect(p.allocations.reduce((s, a) => s + a.qty, 0)).toBe(22);
  });
  it("ignores services and limits warehouses", () => {
    expect(
      planSplit([{ ...line, isPhysical: false }], warehouses, policy).shipments,
    ).toBe(0);
    expect(
      planSplit([line], warehouses, { ...policy, maxWarehousesPerOrder: 1 })
        .backorders[0].qty,
    ).toBe(6);
  });
  it("prefers cheaper shipments for equal coverage", () => {
    const p = planSplit(
      [{ ...line, qty: 2 }],
      [
        ...warehouses,
        {
          ...warehouses[0],
          warehouseId: "cheap",
          code: "Z",
          fixedShipmentCostMinor: 100,
        },
      ],
      policy,
    );
    expect(p.warehousesUsed).toEqual(["cheap"]);
  });
  it("checks conservation of ordered units", () => {
    expect(
      checkLineInvariant(
        { qty: 24, qtyShipped: 18 },
        [{ qty: 4, qtyShipped: 0, reserved: true }],
        [{ qty: 2, status: "OPEN" }],
      ),
    ).toBe(true);
  });
});
