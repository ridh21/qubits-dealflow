import { z } from "zod";
import { BpZ } from "@/domain/policy/schemas";
const id = z.string().min(1).max(100);
export const QuoteVersionInput = z.object({
  id,
  expectedVersion: z.number().int().positive(),
});
export const CreateQuoteInput = z.object({
  customerId: id,
  validUntil: z.coerce.date().optional(),
});
export const AddQuoteLineInput = QuoteVersionInput.extend({
  productId: id,
  variantValueIds: z.array(id).max(20).default([]),
  planId: id.optional(),
  qty: z.number().int().min(1).max(1000000),
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
        qty: z.number().int().min(1).max(1000000),
        discountBp: BpZ,
      }),
    )
    .max(500),
});
export const QuoteReasonInput = QuoteVersionInput.extend({
  reason: z.string().trim().min(1).max(1000),
});
