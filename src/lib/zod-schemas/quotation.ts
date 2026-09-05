import { z } from "zod";
import { BpZ } from "@/domain/policy/schemas";
const id = z.string().min(1).max(100);
export const QuoteVersionInput = z.object({
  id,
  expectedVersion: z.number().int().positive("The quotation changed. Reload and try again."),
});
export const CreateQuoteInput = z.object({
  customerId: id,
  validUntil: z.coerce.date().optional(),
});
export const AddQuoteLineInput = QuoteVersionInput.extend({
  productId: id,
  variantValueIds: z.array(id).max(20).default([]),
  planId: id.optional(),
  qty: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1000000, "Quantity is too large."),
  discountBp: BpZ.default(0),
  addedFromUpsell: z.boolean().default(false),
});
export const EditQuoteInput = QuoteVersionInput.extend({
  orderDiscountBp: BpZ,
  customerNote: z.string().max(4000).nullable(),
  requestedDeliveryDate: z.coerce.date().nullable(),
  validUntil: z.coerce.date().nullable(),
  lines: z
    .array(
      z.object({
        id,
        qty: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1000000, "Quantity is too large."),
        discountBp: BpZ,
      }),
    )
    .max(500),
});
export const QuoteReasonInput = QuoteVersionInput.extend({
  reason: z.string().trim().min(1, "Give a reason.").max(1000),
});
