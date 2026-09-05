-- Currency is a historical snapshot, never a default for all customers.
-- Keep this atomic: unresolved source references must roll back the DDL too.
BEGIN;
ALTER TABLE "CreditNote" ADD COLUMN "currency" TEXT;

UPDATE "CreditNote" AS credit
SET "currency" = CASE
  WHEN credit."sourceInvoiceId" IS NOT NULL THEN
    (SELECT invoice."currency" FROM "Invoice" AS invoice
     WHERE invoice."id" = credit."sourceInvoiceId")
  WHEN credit."subscriptionId" IS NOT NULL THEN
    (SELECT orders."currency" FROM "Subscription" AS subscription
     JOIN "Order" AS orders ON orders."id" = subscription."orderId"
     WHERE subscription."id" = credit."subscriptionId")
  ELSE
    (SELECT customer."currency" FROM "Customer" AS customer
     WHERE customer."id" = credit."customerId")
END;

-- sourceInvoiceId has no foreign key. Do not silently re-denominate credits
-- whose historical invoice is missing by falling back to today's customer.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CreditNote" WHERE "currency" IS NULL) THEN
    RAISE EXCEPTION 'Credit currency backfill has unresolved sources; repair references before retrying';
  END IF;
END $$;

ALTER TABLE "CreditNote" ALTER COLUMN "currency" SET NOT NULL;
CREATE INDEX "CreditNote_customerId_currency_createdAt_id_idx"
  ON "CreditNote"("customerId", "currency", "createdAt", "id");
COMMIT;
