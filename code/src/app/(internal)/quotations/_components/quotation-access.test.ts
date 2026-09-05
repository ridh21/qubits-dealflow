import { describe, expect, it } from "vitest";
import {
  canEditQuotation,
  canManageQuotation,
  canReviseQuotation,
} from "./quotation-access";
const quote = { ownerId: "owner", status: "DRAFT" };
describe("quotation UI permissions", () => {
  it.each([
    ["SALES_REP", "owner", true],
    ["SALES_REP", "other", false],
    ["SALES_MANAGER", "other", true],
    ["ADMIN", "other", true],
    ["FINANCE", "owner", false],
    ["CUSTOMER", "owner", false],
    ["PENDING", "owner", false],
  ])("shows editing only to an editor: %s / %s", (role, id, expected) => {
    expect(canManageQuotation(quote, { role, id })).toBe(expected);
    expect(canEditQuotation(quote, { role, id })).toBe(expected);
  });
  it.each([
    "APPROVED",
    "SENT",
    "UNDER_NEGOTIATION",
    "PENDING_APPROVAL",
    "REJECTED",
    "CONFIRMED",
    "CANCELLED",
    "EXPIRED",
  ])("locks terms in %s", (status) => {
    expect(
      canEditQuotation(
        { ...quote, status },
        { id: "owner", role: "SALES_REP" },
      ),
    ).toBe(false);
  });
  it("allows requested revisions and keeps pending withdrawal owner-only", () => {
    expect(
      canEditQuotation(
        { ...quote, status: "REVISION_REQUESTED" },
        { id: "owner", role: "SALES_REP" },
      ),
    ).toBe(true);
    expect(
      canReviseQuotation(
        { ...quote, status: "PENDING_APPROVAL" },
        { id: "other", role: "ADMIN" },
      ),
    ).toBe(false);
    expect(
      canReviseQuotation(
        { ...quote, status: "PENDING_APPROVAL" },
        { id: "owner", role: "SALES_REP" },
      ),
    ).toBe(true);
    expect(
      canReviseQuotation(
        { ...quote, status: "CONFIRMED" },
        { id: "owner", role: "ADMIN" },
      ),
    ).toBe(false);
  });
});
