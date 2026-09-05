"use server";

import { searchQuotationCustomers } from "@/server/queries/quotations";

/** Typeahead source for the quotation customer picker. */
export async function searchCustomersAction(query: string) {
  return searchQuotationCustomers(query);
}
