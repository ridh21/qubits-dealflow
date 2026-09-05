import { describe, it, expect } from "vitest";
import { reportQuotationWhere, reportInvoiceWhere } from "./scope";
import { parseReportFilters, reportPeriod } from "@/lib/zod-schemas/reports";
const actor = {
  id: "rep",
  name: "Rep",
  email: "r@test",
  role: "SALES_REP",
  teamId: "team",
  customerId: null,
};
const filters = parseReportFilters({
  from: "2026-09-01",
  to: "2026-09-30",
  ownerId: "another",
  teamId: "another-team",
});
describe("report access and filters", () => {
  it("admits standalone invoices only for finance/admin without quotation dimensions", () => {
    const basic = parseReportFilters({
      from: "2026-09-01",
      to: "2026-09-30",
      customerId: "customer",
    });
    expect(reportInvoiceWhere(actor, basic).OR).toBeUndefined();
    expect(
      reportInvoiceWhere({ ...actor, role: "FINANCE" }, basic).OR,
    ).toContainEqual({
      orderId: null,
      customerId: "customer",
      customer: undefined,
    });
    expect(
      reportInvoiceWhere(
        { ...actor, role: "ADMIN" },
        { ...basic, ownerId: actor.id },
      ).OR,
    ).toBeUndefined();
    expect(() =>
      reportInvoiceWhere({ ...actor, role: "CUSTOMER" }, basic),
    ).toThrow();
  });
  it("intersects rep scope with requested owner and team", () => {
    const result = reportQuotationWhere(actor, filters);
    expect(result.AND).toContainEqual({ ownerId: "rep" });
    expect(result.AND).toContainEqual(
      expect.objectContaining({
        ownerId: "another",
        owner: { teamId: "another-team" },
      }),
    );
  });
  it("limits managers to themselves and their team", () => {
    expect(
      reportQuotationWhere({ ...actor, role: "SALES_MANAGER" }, filters).AND,
    ).toContainEqual({
      OR: [{ ownerId: "rep" }, { owner: { teamId: "team" } }],
    });
  });
  it("denies portal and pending accounts", () => {
    for (const role of ["CUSTOMER", "PENDING"])
      expect(() => reportQuotationWhere({ ...actor, role }, filters)).toThrow();
  });
  it("validates ranges and uses an exclusive end boundary", () => {
    expect(() =>
      parseReportFilters({ from: "2026-10-01", to: "2026-09-01" }),
    ).toThrow();
    expect(reportPeriod(filters).to).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(
      parseReportFilters({ from: "2026-09-01", to: "2026-09-30", cycle: "" })
        .cycle,
    ).toBeUndefined();
  });
});
