import { describe, expect, it } from "vitest";
import {
  requireQuotationCustomer,
  requireQuotationCustomerId,
} from "./require-customer";
import { ValidationError } from "@/domain/errors";

describe("quotation customer requirement", () => {
  it("rejects a draft that has no customer yet", () => {
    expect(() => requireQuotationCustomerId({ customerId: null })).toThrow(
      ValidationError,
    );
    expect(() => requireQuotationCustomer({ customer: null })).toThrow(
      ValidationError,
    );
  });

  it("explains why the customer matters, not just that it is missing", () => {
    expect(() => requireQuotationCustomerId({ customerId: null })).toThrow(
      /pricing, discount limits and currency/i,
    );
  });

  it("passes the customer through once one is set", () => {
    expect(requireQuotationCustomerId({ customerId: "cus_1" })).toBe("cus_1");
    const customer = { id: "cus_1", tier: "GOLD" };
    expect(requireQuotationCustomer({ customer })).toBe(customer);
  });
});
