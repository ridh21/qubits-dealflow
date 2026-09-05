import { pctOf } from "../money/money";
import { periodAmount } from "../proration/prorate";
import type { Period } from "../proration/period";

export interface OrderInvoiceLine {
  id: string;
  productName: string;
  qty: number;
  qtyInvoiced: number;
  unitPriceMinor: number;
  netMinor: number;
  taxMinor: number;
}
export interface ShipmentInvoiceLine {
  orderLineId: string;
  qty: number;
}
export interface InvoiceLine {
  description: string;
  qty: number;
  unitPriceMinor: number;
  amountMinor: number;
  taxMinor: number;
  orderLineId?: string;
  subscriptionId?: string;
  periodStart?: Date;
  periodEnd?: Date;
}
export interface RecurringSubscription {
  id: string;
  orderLineId?: string;
  qty: number;
  unitPriceMinor: number;
  discountBp: number;
  taxBp: number;
  description?: string;
}

/** Allocate cents to individual units, with remainder cents on the earliest units.
 * Taking a cumulative slice makes totals independent of shipment grouping.
 */
export function proportionalSlice(
  totalMinor: number,
  qty: number,
  offset: number,
  count: number,
): number {
  if (
    ![totalMinor, qty, offset, count].every(Number.isSafeInteger) ||
    totalMinor < 0 ||
    qty <= 0 ||
    offset < 0 ||
    count < 0 ||
    offset + count > qty
  ) {
    throw new RangeError("Invalid shipment allocation");
  }
  const base = Math.floor(totalMinor / qty);
  const remainder = totalMinor % qty;
  return (
    base * count +
    Math.min(offset + count, remainder) -
    Math.min(offset, remainder)
  );
}

export function shipmentInvoiceLines(
  orderLines: readonly OrderInvoiceLine[],
  shipmentLines: readonly ShipmentInvoiceLine[],
): InvoiceLine[] {
  const lines = new Map(orderLines.map((line) => [line.id, line]));
  const offsets = new Map(
    orderLines.map((line) => [line.id, line.qtyInvoiced]),
  );
  return shipmentLines.map((shipment) => {
    const line = lines.get(shipment.orderLineId);
    if (!line) throw new RangeError("Unknown shipment order line");
    if (shipment.qty <= 0)
      throw new RangeError("Shipped quantity must be positive");
    const offset = offsets.get(line.id)!;
    const amountMinor = proportionalSlice(
      line.netMinor,
      line.qty,
      offset,
      shipment.qty,
    );
    const taxMinor = proportionalSlice(
      line.taxMinor,
      line.qty,
      offset,
      shipment.qty,
    );
    offsets.set(line.id, offset + shipment.qty);
    return {
      description: line.productName,
      qty: shipment.qty,
      unitPriceMinor: line.unitPriceMinor,
      amountMinor,
      taxMinor,
      orderLineId: line.id,
    };
  });
}

export function completionInvoiceLine(
  line: Omit<OrderInvoiceLine, "qtyInvoiced">,
): InvoiceLine {
  return {
    description: line.productName,
    qty: line.qty,
    unitPriceMinor: line.unitPriceMinor,
    amountMinor: line.netMinor,
    taxMinor: line.taxMinor,
    orderLineId: line.id,
  };
}

export function recurringInvoiceLine(
  sub: RecurringSubscription,
  period: Period,
): InvoiceLine {
  const amountMinor = periodAmount(sub.qty, sub.unitPriceMinor, sub.discountBp);
  return {
    description: sub.description ?? "Subscription period",
    qty: sub.qty,
    unitPriceMinor: sub.unitPriceMinor,
    amountMinor,
    taxMinor: pctOf(amountMinor, sub.taxBp),
    subscriptionId: sub.id,
    orderLineId: sub.orderLineId,
    periodStart: new Date(period.start),
    periodEnd: new Date(period.end),
  };
}
