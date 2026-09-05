import { runForQuotation } from "./services/deal-health.service";
import { on } from "./events";

let registered = false;

/** Called once from instrumentation.ts. Handlers must never throw. */
export function registerEventHandlers() {
  if (registered) return;
  registered = true;

  for (const event of [
    "quotation.activity",
    "quotation.submitted",
    "quotation.revised",
  ] as const) {
    on(event, async ({ quotationId }) => {
      await runForQuotation(quotationId);
    });
  }

  on("stock.received", ({ warehouseId, productId, qty }) => {
    console.info(
      `[events] stock.received ${qty} of ${productId} @ ${warehouseId}`,
    );
  });
  on("user.approved", ({ userId, role }) => {
    console.info(`[events] user.approved ${userId} as ${role}`);
  });
}
