import { beforeEach, describe, expect, it, vi } from "vitest";
import { Conflict, Forbidden, NotFound } from "@/domain/errors";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({ requireRole: mocks.auth }));
vi.mock("@/server/queries/quotations", () => ({ getQuotation: mocks.get }));
vi.mock("@/server/services/quotation.service", () => ({
  SALES_ROLES: ["SALES_REP", "SALES_MANAGER", "ADMIN"],
  setCustomer: mocks.set,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { changeQuotationCustomerAction } from "./change-customer";
const actor = { id: "rep", role: "SALES_REP", teamId: null, customerId: null };
const input = { id: "quote", expectedVersion: 3, customerId: "new-customer" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(actor);
  mocks.get.mockResolvedValue({});
  mocks.set.mockResolvedValue({ id: "quote", version: 4 });
});
describe("change quotation customer action", () => {
  it("checks scope, delegates the locked edit and refreshes the detail and lists", async () => {
    expect(await changeQuotationCustomerAction(input)).toEqual({
      ok: true,
      data: { id: "quote", version: 4 },
    });
    expect(mocks.auth).toHaveBeenCalledWith([
      "SALES_REP",
      "SALES_MANAGER",
      "ADMIN",
    ]);
    expect(mocks.get).toHaveBeenCalledWith("quote");
    expect(mocks.set).toHaveBeenCalledWith(actor, "quote", 3, "new-customer");
    expect(mocks.get.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.set.mock.invocationCallOrder[0],
    );
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/quotations/quote"],
      ["/quotations"],
      ["/dashboard"],
    ]);
  });
  it.each([
    { ...input, customerId: "" },
    { ...input, expectedVersion: 0 },
    { ...input, customerId: "x".repeat(101) },
  ])(
    "rejects invalid input before any scoped read or write",
    async (invalid) => {
      expect(await changeQuotationCustomerAction(invalid)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.set).not.toHaveBeenCalled();
    },
  );
  it("does not invoke the service when the quotation is outside the current scope", async () => {
    mocks.get.mockRejectedValue(
      new NotFound("Quotation unavailable in your scope."),
    );
    expect(await changeQuotationCustomerAction(input)).toMatchObject({
      ok: false,
    });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves service concurrency failures without refreshing stale data", async () => {
    mocks.set.mockRejectedValue(
      new Conflict("This quote changed. Reload before saving."),
    );
    expect(await changeQuotationCustomerAction(input)).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This quote changed. Reload before saving.",
      },
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("does not invoke reads or writes when authorization fails", async () => {
    mocks.auth.mockRejectedValue(new Forbidden());
    expect(await changeQuotationCustomerAction(input)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
