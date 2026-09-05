import { DAY_MS, type HealthFinding } from "./types";
export interface DeliveryOrder {
  id: string;
  promisedDeliveryDate: Date | null;
  unshippedQty: number;
  openBackorderQty: number;
  earliestReplenishmentEta: Date | null;
}
export function detectSlippage(
  orders: DeliveryOrder[],
  now: Date,
  windowDays: number,
): HealthFinding[] {
  return orders.flatMap((order) => {
    const promise = order.promisedDeliveryDate;
    if (!promise || order.unshippedQty <= 0) return [];
    let severity: "HIGH" | "MEDIUM" = "HIGH",
      label: string;
    if (promise < now)
      label = `Promise missed by ${Math.ceil((now.getTime() - promise.getTime()) / DAY_MS)} days; ${order.unshippedQty} units unshipped`;
    else if (
      order.openBackorderQty > 0 &&
      (!order.earliestReplenishmentEta ||
        order.earliestReplenishmentEta > promise)
    )
      label = order.earliestReplenishmentEta
        ? `ETA ${order.earliestReplenishmentEta.toISOString().slice(0, 10)} after promise ${promise.toISOString().slice(0, 10)}`
        : `Backorder ${order.openBackorderQty} units; no replenishment before promise`;
    else if (promise.getTime() - now.getTime() <= windowDays * DAY_MS) {
      severity = "MEDIUM";
      label = `Delivery due within ${windowDays} days; ${order.unshippedQty} units unshipped`;
    } else return [];
    return [
      {
        type: "DELIVERY_SLIPPAGE",
        orderId: order.id,
        severity,
        detail: {
          label,
          unshippedQty: order.unshippedQty,
          openBackorderQty: order.openBackorderQty,
          promisedDeliveryDate: promise.toISOString(),
          earliestReplenishmentEta:
            order.earliestReplenishmentEta?.toISOString() ?? null,
        },
      },
    ];
  });
}
