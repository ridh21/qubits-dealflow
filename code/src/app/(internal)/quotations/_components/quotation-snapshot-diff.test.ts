import { describe, expect, it } from "vitest";
import { quotationSnapshotDiff } from "./quotation-snapshot-diff";
const line = {
  id: "line-a",
  productId: "dock",
  productName: "Dock",
  qty: 1,
  unitPriceMinor: 10000,
  discountBp: 0,
  variantValueIds: ["red", "large"],
};
const initial = {
  currency: "USD",
  customerId: "customer-a",
  lines: [line],
  orderDiscountBp: 0,
  oneTimeNetMinor: 10000,
};
describe("quotation snapshot comparison", () => {
  it("compares line identity instead of array indexes or variant selection order", () => {
    const second = { ...line, id: "line-b", productName: "Care" };
    expect(
      quotationSnapshotDiff(
        { ...initial, lines: [line, second] },
        {
          ...initial,
          lines: [second, { ...line, variantValueIds: ["large", "red"] }],
        },
      ).changes,
    ).toEqual([]);
  });
  it("shows quantity, discounts, allocated pricing and margins with meaningful labels", () => {
    const result = quotationSnapshotDiff(initial, {
      ...initial,
      lines: [
        {
          ...line,
          qty: 2,
          discountBp: 1250,
          orderDiscountAllocMinor: 400,
          marginMinor: 5000,
        },
      ],
    });
    expect(result.available).toBe(true);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Line: Dock (line-a)",
          field: "Quantity",
          before: "1",
          after: "2",
        }),
        expect.objectContaining({
          field: "Line discount",
          before: "0%",
          after: "12.50%",
        }),
        expect.objectContaining({
          field: "Allocated order discount",
          before: "Not set",
          after: "USD $4.00",
        }),
        expect.objectContaining({ field: "Margin", after: "USD $50.00" }),
      ]),
    );
  });
  it("shows removed and added lines without confusing replacements", () => {
    const result = quotationSnapshotDiff(initial, {
      ...initial,
      lines: [{ ...line, id: "line-new", productName: "Setup" }],
    });
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Line: Dock (line-a)",
          field: "Removed line",
          after: "Not set",
        }),
        expect.objectContaining({
          section: "Line: Setup (line-new)",
          field: "Added line",
          before: "Not set",
        }),
      ]),
    );
    expect(result.changes[0].before).toContain("Unit price: USD $100.00");
  });
  it("formats amounts with each snapshot's currency", () => {
    const result = quotationSnapshotDiff(initial, {
      ...initial,
      currency: "EUR",
      oneTimeNetMinor: 9000,
    });
    expect(result.changes).toContainEqual(
      expect.objectContaining({
        field: "One-time net",
        before: "USD $100.00",
        after: "EUR €90.00",
      }),
    );
  });
  it("shows customer, validity, notes, policy and status changes", () => {
    const result = quotationSnapshotDiff(
      { ...initial, status: "DRAFT" },
      {
        ...initial,
        customerId: "customer-b",
        validUntil: "2026-12-01",
        customerNote: "Deliver upstairs",
        policyVersionId: "policy-v3",
        requiredLevel: 2,
        status: "PENDING_APPROVAL",
      },
      { "customer-a": "Alpha", "customer-b": "Beta" },
    );
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Customer",
          before: "Alpha (customer-a)",
          after: "Beta (customer-b)",
        }),
        expect.objectContaining({ field: "Valid until", after: "2026-12-01" }),
        expect.objectContaining({
          field: "Customer note",
          after: "Deliver upstairs",
        }),
        expect.objectContaining({
          field: "Policy version",
          after: "policy-v3",
        }),
        expect.objectContaining({
          field: "Status",
          before: "DRAFT",
          after: "PENDING_APPROVAL",
        }),
      ]),
    );
  });
  it("keeps recurring cycles distinct from one-time amounts", () => {
    const before = {
      ...initial,
      recurringByCycle: {
        MONTHLY: { netMinor: 1000, marginBp: 2000 },
        YEARLY: { netMinor: 9000 },
      },
    };
    const after = {
      ...before,
      recurringByCycle: {
        MONTHLY: { netMinor: 2000, marginBp: 2500 },
        YEARLY: { netMinor: 9000 },
      },
    };
    expect(quotationSnapshotDiff(before, after).changes).toEqual([
      expect.objectContaining({
        section: "Recurring: monthly (initial period)",
        field: "Margin rate",
        before: "20%",
        after: "25%",
      }),
      expect.objectContaining({
        section: "Recurring: monthly (initial period)",
        field: "Net",
        before: "USD $10.00",
        after: "USD $20.00",
      }),
    ]);
  });
  it("omits token, unrelated metadata and unrecognized payload fields", () => {
    expect(
      quotationSnapshotDiff(initial, {
        ...initial,
        portalToken: "secret",
        riskMetrics: { token: "secret" },
        updatedAt: "later",
        lastActivityAt: "later",
        lines: [{ ...line, privateToken: "secret" }],
      }).changes,
    ).toEqual([]);
    expect(
      JSON.stringify(
        quotationSnapshotDiff({}, { ...initial, portalToken: "secret" }),
      ),
    ).not.toContain("secret");
  });
  it.each([null, [], "invalid"])(
    "reports unavailable snapshot %s",
    (invalid) => {
      expect(quotationSnapshotDiff(initial, invalid)).toEqual({
        available: false,
        changes: [],
      });
    },
  );
  it("shows initial snapshots and handles absent or invalid historical currency", () => {
    expect(quotationSnapshotDiff({}, initial).changes.length).toBeGreaterThan(
      0,
    );
    expect(
      quotationSnapshotDiff({}, { oneTimeNetMinor: 100, currency: "invalid" })
        .changes,
    ).toContainEqual(
      expect.objectContaining({
        field: "One-time net",
        after: "100 minor units",
      }),
    );
  });
});
