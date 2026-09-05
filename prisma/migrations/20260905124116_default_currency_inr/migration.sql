-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "PriceList" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "Quotation" ALTER COLUMN "currency" SET DEFAULT 'INR';
