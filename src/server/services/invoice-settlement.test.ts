import { describe, expect, it, vi } from "vitest";
import { settleInvoiceTotals } from "./invoice-settlement";

function txFor(invoice: {
  totalMinor: number;
  paidMinor: number;
  creditAppliedMinor: number;
}) {
  const update = vi.fn(async (args: { data: Record<string, unknown> }) => {
    void args;
    return invoice;
  });
  return {
    tx: {
      invoice: { findUniqueOrThrow: async () => ({ ...invoice, dueAt: null }), update },
    } as never,
    update,
  };
}

describe("stored invoice settlement", () => {
  it("writes the outstanding balance so the database can filter on it", async () => {
    const { tx, update } = txFor({
      totalMinor: 10_000,
      paidMinor: 2_500,
      creditAppliedMinor: 1_500,
    });
    await settleInvoiceTotals(tx, "inv-1");
    expect(update.mock.calls[0]?.[0].data).toEqual({
      balanceMinor: 6_000,
      paymentStatus: "PARTIALLY_PAID",
    });
  });

  it("marks an invoice paid once payments and credits cover the total", async () => {
    const { tx, update } = txFor({
      totalMinor: 10_000,
      paidMinor: 4_000,
      creditAppliedMinor: 6_000,
    });
    await settleInvoiceTotals(tx, "inv-2");
    expect(update.mock.calls[0]?.[0].data).toEqual({
      balanceMinor: 0,
      paymentStatus: "PAID",
    });
  });

  it("reports an untouched invoice as unpaid for its full total", async () => {
    const { tx, update } = txFor({
      totalMinor: 10_000,
      paidMinor: 0,
      creditAppliedMinor: 0,
    });
    await settleInvoiceTotals(tx, "inv-3");
    expect(update.mock.calls[0]?.[0].data).toEqual({
      balanceMinor: 10_000,
      paymentStatus: "UNPAID",
    });
  });

  it("refuses to persist a settlement that overpays the invoice", async () => {
    const { tx } = txFor({
      totalMinor: 1_000,
      paidMinor: 900,
      creditAppliedMinor: 900,
    });
    await expect(settleInvoiceTotals(tx, "inv-4")).rejects.toThrow(RangeError);
  });
});
