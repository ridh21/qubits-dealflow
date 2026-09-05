import { expect, it } from "vitest";
import { derivePaymentStatus } from "./payment-status";
const now = new Date("2026-09-05");
const invoice = {
  totalMinor: 1000,
  paidMinor: 200,
  creditAppliedMinor: 300,
  dueAt: new Date("2026-09-04"),
};
it("derives credit plus partial payment, settlement and overdue", () => {
  expect(derivePaymentStatus(invoice, now)).toEqual({
    balanceMinor: 500,
    paymentStatus: "PARTIALLY_PAID",
    isOverdue: true,
  });
  expect(derivePaymentStatus({ ...invoice, paidMinor: 700 }, now)).toEqual({
    balanceMinor: 0,
    paymentStatus: "PAID",
    isOverdue: false,
  });
  expect(
    derivePaymentStatus({ ...invoice, paidMinor: 0 }, now).paymentStatus,
  ).toBe("UNPAID");
  expect(
    derivePaymentStatus(
      { ...invoice, paidMinor: 0, creditAppliedMinor: 1000 },
      now,
    ).paymentStatus,
  ).toBe("PAID");
});
it("treats due-at equality as not overdue and supports zero invoices", () => {
  expect(derivePaymentStatus({ ...invoice, dueAt: now }, now).isOverdue).toBe(
    false,
  );
  expect(derivePaymentStatus({ ...invoice, dueAt: null }, now).isOverdue).toBe(
    false,
  );
  expect(
    derivePaymentStatus(
      { totalMinor: 0, paidMinor: 0, creditAppliedMinor: 0, dueAt: now },
      now,
    ).paymentStatus,
  ).toBe("PAID");
  expect(() =>
    derivePaymentStatus({ ...invoice, paidMinor: 1000 }, now),
  ).toThrow();
});
