"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAction } from "@/server/actions/run-action";
import { QuoteVersionInput } from "@/lib/zod-schemas/quotation";
import { SALES_ROLES, setCustomer } from "@/server/services/quotation.service";
import { getQuotation } from "@/server/queries/quotations";

export async function changeQuotationCustomerAction(input: unknown) {
  return runAction({
    roles: SALES_ROLES,
    schema: QuoteVersionInput.extend({
      customerId: z.string().min(1).max(100),
    }),
    input,
    execute: async (actor, data) => {
      // Reuse detail scope before the service's locked version/editability checks.
      await getQuotation(data.id);
      const result = await setCustomer(
        actor,
        data.id,
        data.expectedVersion,
        data.customerId,
      );
      revalidatePath(`/quotations/${data.id}`);
      return result;
    },
    paths: ["/quotations", "/dashboard"],
  });
}
