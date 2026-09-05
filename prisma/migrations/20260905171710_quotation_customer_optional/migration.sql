-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_customerId_fkey";

-- AlterTable
ALTER TABLE "Quotation" ALTER COLUMN "customerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
