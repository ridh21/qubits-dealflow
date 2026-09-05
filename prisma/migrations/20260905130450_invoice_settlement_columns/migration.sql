-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "balanceMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_dueAt_idx" ON "Invoice"("paymentStatus", "dueAt");

-- Backfill: the new columns are derived from amounts that already exist, so
-- every current row must be settled here. Without this every invoice would
-- read as UNPAID with a zero balance.
UPDATE "Invoice"
SET "balanceMinor" = "totalMinor" - "creditAppliedMinor" - "paidMinor",
    "paymentStatus" = CASE
      WHEN "totalMinor" - "creditAppliedMinor" - "paidMinor" <= 0 THEN 'PAID'::"PaymentStatus"
      WHEN "paidMinor" = 0 THEN 'UNPAID'::"PaymentStatus"
      ELSE 'PARTIALLY_PAID'::"PaymentStatus"
    END;
