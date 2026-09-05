import { it, expect } from "vitest";
import { simulateFulfillment } from "./simulate-fulfillment";
import { POLICY_DEFAULTS } from "./schemas";
it("maximizes coverage before cost and reports warehouse-limit shortages", () => {
  const w = [
    {
      id: "a",
      code: "A",
      priority: 1,
      fixedShipmentCostMinor: 100,
      shippingCostWeightMinor: 0,
      available: { p: 2 },
    },
    {
      id: "b",
      code: "B",
      priority: 2,
      fixedShipmentCostMinor: 500,
      shippingCostWeightMinor: 0,
      available: { p: 5 },
    },
  ];
  const r = simulateFulfillment(
    { ...POLICY_DEFAULTS.FULFILLMENT, maxWarehousesPerOrder: 1 },
    [{ productId: "p", qty: 7 }],
    w,
  );
  expect(r.shipments[0].code).toBe("B");
  expect(r.backorders).toEqual([{ productId: "p", qty: 2 }]);
  expect(w[1].available.p).toBe(5);
});
it("breaks ties deterministically by configured priority or code", () => {
  const w = [
    {
      id: "a",
      code: "A",
      priority: 2,
      fixedShipmentCostMinor: 0,
      shippingCostWeightMinor: 0,
      available: { p: 2 },
    },
    {
      id: "b",
      code: "B",
      priority: 1,
      fixedShipmentCostMinor: 0,
      shippingCostWeightMinor: 0,
      available: { p: 2 },
    },
  ];
  expect(
    simulateFulfillment(
      POLICY_DEFAULTS.FULFILLMENT,
      [{ productId: "p", qty: 2 }],
      w,
    ).shipments[0].code,
  ).toBe("B");
  expect(
    simulateFulfillment(
      { ...POLICY_DEFAULTS.FULFILLMENT, tieBreak: "CODE" },
      [{ productId: "p", qty: 2 }],
      w,
    ).shipments[0].code,
  ).toBe("A");
});
