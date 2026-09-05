/**
 * Tiny in-process typed event bus. Services `emit` AFTER their transaction has
 * committed, so a handler never observes a row that later rolls back.
 */
export interface AppEvents {
  "quotation.activity": { quotationId: string };
  "quotation.submitted": { quotationId: string; version: number };
  "quotation.approved": { quotationId: string; version: number };
  "quotation.rejected": { quotationId: string; version: number };
  "quotation.returned": { quotationId: string; version: number };
  "quotation.revised": { quotationId: string; version: number };
  "quotation.sent": { quotationId: string; version: number };
  "quotation.accepted": { quotationId: string; version: number };
  "quotation.confirmed": { quotationId: string; orderId: string };
  "approval.step.pending": { requestId: string; stepId: string; role: string };
  "order.created": { orderId: string };
  "order.shipped": { orderId: string; shipmentId: string };
  "service.completed": { orderId: string; orderLineId: string };
  "stock.received": { warehouseId: string; productId: string; qty: number };
  "subscription.activated": { subscriptionId: string };
  "subscription.paused": { subscriptionId: string };
  "subscription.resumed": { subscriptionId: string };
  "subscription.changed": { subscriptionId: string; kind: string };
  "subscription.cancelled": { subscriptionId: string };
  "plan.changed": { noticeId: string };
  "alert.created": { alertId: string; type: string };
  "user.approved": { userId: string; role: string };
}

type Handler<K extends keyof AppEvents> = (
  payload: AppEvents[K],
) => void | Promise<void>;

const handlers = new Map<keyof AppEvents, Set<Handler<never>>>();

export function on<K extends keyof AppEvents>(event: K, handler: Handler<K>) {
  const set = handlers.get(event) ?? new Set();
  set.add(handler as Handler<never>);
  handlers.set(event, set);
  return () => set.delete(handler as Handler<never>);
}

export async function emit<K extends keyof AppEvents>(
  event: K,
  payload: AppEvents[K],
) {
  const set = handlers.get(event);
  if (!set?.size) return;
  for (const h of set) {
    try {
      await (h as Handler<K>)(payload);
    } catch (e) {
      console.error(`[events] handler for ${String(event)} failed`, e);
    }
  }
}
