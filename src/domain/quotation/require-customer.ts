import { ValidationError } from "@/domain/errors";

const MESSAGE =
  "Select a customer for this quotation first. Pricing, discount limits and currency all come from it.";

/**
 * A draft starts without a customer, so every step that depends on one goes
 * through these guards rather than a non-null assertion. Kept in the domain
 * layer so services can share it without importing each other.
 */
export function requireQuotationCustomerId(q: { customerId: string | null }) {
  if (!q.customerId) throw new ValidationError(MESSAGE);
  return q.customerId;
}

export function requireQuotationCustomer<T>(q: { customer: T | null }): T {
  if (!q.customer) throw new ValidationError(MESSAGE);
  return q.customer;
}
