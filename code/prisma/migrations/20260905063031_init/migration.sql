-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PENDING', 'ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "RecurringInterval" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceRule" AS ENUM ('NO_ADJUSTMENT', 'PERCENT_OFF_BASE', 'FIXED_ITEMS');

-- CreateEnum
CREATE TYPE "PolicyKind" AS ENUM ('DISCOUNT_RISK', 'FULFILLMENT', 'BILLING', 'DEAL_HEALTH', 'PORTAL', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'RESERVE', 'RELEASE', 'SHIP', 'ADJUST');

-- CreateEnum
CREATE TYPE "ProrationRule" AS ENUM ('DAILY', 'NONE');

-- CreateEnum
CREATE TYPE "CancellationRule" AS ENUM ('NONE', 'PRORATED_CREDIT', 'FULL_CREDIT');

-- CreateEnum
CREATE TYPE "EntitlementPer" AS ENUM ('DAY', 'WEEK', 'MONTH', 'CYCLE');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('INT', 'BOOL', 'TEXT');

-- CreateEnum
CREATE TYPE "UpsellSource" AS ENUM ('MANUAL', 'COPURCHASE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUESTED', 'REJECTED', 'APPROVED', 'SENT', 'UNDER_NEGOTIATION', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('SALES_MANAGER', 'FINANCE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CUSTOMER', 'INTERNAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('OPEN', 'APPLIED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNALLOCATED', 'RESERVED', 'PARTIALLY_FULFILLED', 'BACKORDERED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "BackorderStatus" AS ENUM ('OPEN', 'CONSOLIDATION_SUGGESTED', 'ALLOCATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PLANNED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PAUSE_SCHEDULED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransitionType" AS ENUM ('ACTIVATE', 'PAUSE_REQUESTED', 'PAUSE_WITHDRAWN', 'PAUSED', 'RESUME_SELECTED', 'RESUME_CHANGED', 'RESUMED', 'QTY_CHANGED', 'PLAN_CHANGED', 'CANCEL_REQUESTED', 'CANCELLED', 'PERIOD_ADVANCED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('UPCOMING', 'INVOICED', 'SKIPPED_PAUSED', 'SKIPPED_CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('ONE_TIME', 'SERVICE', 'RECURRING', 'PRORATION');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('STALLED', 'DISCOUNT_ANOMALY', 'DELIVERY_SLIPPAGE', 'APPROVAL_SLA');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'NUDGED', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PENDING',
    "teamId" TEXT,
    "customerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PORTAL_LOGIN'
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "CustomerTier" NOT NULL DEFAULT 'BRONZE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "email" TEXT,
    "billingAddress" TEXT,
    "priceListId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "unit" TEXT NOT NULL DEFAULT 'Each',
    "basePriceMinor" INTEGER NOT NULL,
    "costPriceMinor" INTEGER NOT NULL,
    "taxBp" INTEGER NOT NULL DEFAULT 0,
    "isPromoted" BOOLEAN NOT NULL DEFAULT false,
    "minMarginBp" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VariantAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantValue" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "extraPriceMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VariantValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tier" "CustomerTier",
    "rule" "PriceRule" NOT NULL DEFAULT 'NO_ADJUSTMENT',
    "percentOffBp" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "kind" "PolicyKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "key" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shippingCostWeightMinor" INTEGER NOT NULL DEFAULT 0,
    "fixedShipmentCostMinor" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "type" "MovementType" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentPlan" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "eta" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplenishmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierId" TEXT,
    "interval" "RecurringInterval" NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "prorationRule" "ProrationRule" NOT NULL DEFAULT 'DAILY',
    "cancellationRule" "CancellationRule" NOT NULL DEFAULT 'PRORATED_CREDIT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementDefinition" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "per" "EntitlementPer" NOT NULL DEFAULT 'CYCLE',
    "valueType" "EntitlementType" NOT NULL DEFAULT 'INT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntitlementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementValue" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "interval" "RecurringInterval",
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChangeNotice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "interval" "RecurringInterval",
    "changes" JSONB NOT NULL,
    "effectiveRule" TEXT NOT NULL DEFAULT 'NEXT_CYCLE',
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanChangeNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellRule" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "suggestedProductId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "source" "UpsellSource" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "UpsellRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceListId" TEXT,
    "orderDiscountBp" INTEGER NOT NULL DEFAULT 0,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "oneTimeNetMinor" INTEGER NOT NULL DEFAULT 0,
    "oneTimeMarginMinor" INTEGER NOT NULL DEFAULT 0,
    "recurringByCycle" JSONB,
    "riskBand" "RiskBand" NOT NULL DEFAULT 'LOW',
    "requiredLevel" INTEGER NOT NULL DEFAULT 0,
    "riskMetrics" JSONB,
    "policyVersionId" TEXT,
    "approvedVersion" INTEGER,
    "portalToken" TEXT,
    "validUntil" TIMESTAMP(3),
    "requestedDeliveryDate" TIMESTAMP(3),
    "customerNote" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "variantValueIds" TEXT[],
    "variantLabel" TEXT,
    "planId" TEXT,
    "interval" "RecurringInterval",
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "costPriceMinor" INTEGER NOT NULL,
    "taxBp" INTEGER NOT NULL,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "baseMinor" INTEGER NOT NULL DEFAULT 0,
    "lineDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "orderDiscountAllocMinor" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "effectiveDiscountBp" INTEGER NOT NULL DEFAULT 0,
    "limitBp" INTEGER NOT NULL DEFAULT 0,
    "excessBp" INTEGER NOT NULL DEFAULT 0,
    "marginMinor" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedFromUpsell" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationVersion" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "termsHash" TEXT NOT NULL,
    "policyVersionId" TEXT,
    "riskMetrics" JSONB,
    "requiredLevel" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdByType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAcceptance" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "QuoteAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationVersion" INTEGER NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "metrics" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "role" "ApprovalRole" NOT NULL,
    "assigneeId" TEXT,
    "status" "StepStatus" NOT NULL DEFAULT 'WAITING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "dueAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationMessage" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationVersion" INTEGER NOT NULL,
    "lineId" TEXT,
    "author" "MessageAuthor" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "counterDiscountBp" INTEGER,
    "proposedQty" INTEGER,
    "requestedDeliveryDate" TIMESTAMP(3),
    "status" "ProposalStatus" NOT NULL DEFAULT 'OPEN',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationVersion" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNALLOCATED',
    "promisedDeliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quotationLineId" TEXT NOT NULL,
    "kind" "ProductType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "qtyShipped" INTEGER NOT NULL DEFAULT 0,
    "qtyInvoiced" INTEGER NOT NULL DEFAULT 0,
    "unitPriceMinor" INTEGER NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "taxBp" INTEGER NOT NULL,
    "costPriceMinor" INTEGER NOT NULL,
    "planId" TEXT,
    "interval" "RecurringInterval",
    "discountBp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentPlan" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'SUGGESTED',
    "estimatedShipments" INTEGER NOT NULL,
    "estimatedCostMinor" INTEGER NOT NULL,
    "rationale" JSONB NOT NULL,
    "policyVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "FulfillmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "qtyShipped" INTEGER NOT NULL DEFAULT 0,
    "reserved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backorder" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "BackorderStatus" NOT NULL DEFAULT 'OPEN',
    "suggestedWarehouseId" TEXT,
    "suggestedQty" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backorder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PLANNED',
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "shippedAt" TIMESTAMP(3),
    "shippedById" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentLine" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCompletion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "invoiceId" TEXT,

    CONSTRAINT "ServiceCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "activationDate" TIMESTAMP(3) NOT NULL,
    "billingAnchor" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "pauseRequestedAt" TIMESTAMP(3),
    "pauseEffectiveAt" TIMESTAMP(3),
    "resumeAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelEffectiveAt" TIMESTAMP(3),
    "entitlementsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionTransition" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "TransitionType" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "detail" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingScheduleItem" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'UPCOMING',
    "invoiceId" TEXT,
    "entitlements" JSONB,

    CONSTRAINT "BillingScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "creditAppliedMinor" INTEGER NOT NULL DEFAULT 0,
    "sourceKey" TEXT NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "orderLineId" TEXT,
    "subscriptionId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "sourceInvoiceId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "remainingMinor" INTEGER NOT NULL,
    "refundDueMinor" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditApplication" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealHealthAlert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "RiskBand" NOT NULL,
    "quotationId" TEXT,
    "orderId" TEXT,
    "detail" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "lastActionAt" TIMESTAMP(3),
    "lastAction" TEXT,

    CONSTRAINT "DealHealthAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "relatedType" TEXT,
    "relatedId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" INTEGER,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productId_key" ON "PriceListItem"("priceListId", "productId");

-- CreateIndex
CREATE INDEX "PolicyVersion_kind_isActive_idx" ON "PolicyVersion"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_kind_version_key" ON "PolicyVersion"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_warehouseId_productId_key" ON "StockLevel"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ReplenishmentPlan_productId_eta_idx" ON "ReplenishmentPlan"("productId", "eta");

-- CreateIndex
CREATE UNIQUE INDEX "PlanTier_productId_name_key" ON "PlanTier"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_tierId_interval_key" ON "SubscriptionPlan"("tierId", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementDefinition_productId_key_key" ON "EntitlementDefinition"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementValue_definitionId_tierId_interval_key" ON "EntitlementValue"("definitionId", "tierId", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "UpsellRule_productId_suggestedProductId_key" ON "UpsellRule"("productId", "suggestedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_portalToken_key" ON "Quotation"("portalToken");

-- CreateIndex
CREATE INDEX "Quotation_status_lastActivityAt_idx" ON "Quotation"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Quotation_ownerId_createdAt_idx" ON "Quotation"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationVersion_quotationId_version_key" ON "QuotationVersion"("quotationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAcceptance_quotationId_version_key" ON "QuoteAcceptance"("quotationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_quotationId_quotationVersion_key" ON "ApprovalRequest"("quotationId", "quotationVersion");

-- CreateIndex
CREATE INDEX "ApprovalStep_status_dueAt_idx" ON "ApprovalStep"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quotationId_key" ON "Order"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentPlan_orderId_key" ON "FulfillmentPlan"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_number_key" ON "Shipment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCompletion_orderLineId_key" ON "ServiceCompletion"("orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orderLineId_key" ON "Subscription"("orderLineId");

-- CreateIndex
CREATE INDEX "Subscription_status_nextBillingDate_idx" ON "Subscription"("status", "nextBillingDate");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTransition_idempotencyKey_key" ON "SubscriptionTransition"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingScheduleItem_subscriptionId_periodStart_key" ON "BillingScheduleItem"("subscriptionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_shipmentId_key" ON "Invoice"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sourceKey_key" ON "Invoice"("sourceKey");

-- CreateIndex
CREATE INDEX "Invoice_customerId_dueAt_idx" ON "Invoice"("customerId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_idempotencyKey_key" ON "CreditNote"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DealHealthAlert_type_quotationId_orderId_key" ON "DealHealthAlert"("type", "quotationId", "orderId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "EmailMessage_status_createdAt_idx" ON "EmailMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantValue" ADD CONSTRAINT "VariantValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "VariantAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentPlan" ADD CONSTRAINT "ReplenishmentPlan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentPlan" ADD CONSTRAINT "ReplenishmentPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTier" ADD CONSTRAINT "PlanTier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PlanTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementDefinition" ADD CONSTRAINT "EntitlementDefinition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementValue" ADD CONSTRAINT "EntitlementValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "EntitlementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementValue" ADD CONSTRAINT "EntitlementValue_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PlanTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeNotice" ADD CONSTRAINT "PlanChangeNotice_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "PlanTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellRule" ADD CONSTRAINT "UpsellRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellRule" ADD CONSTRAINT "UpsellRule_suggestedProductId_fkey" FOREIGN KEY ("suggestedProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLine" ADD CONSTRAINT "QuotationLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAcceptance" ADD CONSTRAINT "QuoteAcceptance_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationMessage" ADD CONSTRAINT "NegotiationMessage_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentPlan" ADD CONSTRAINT "FulfillmentPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FulfillmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backorder" ADD CONSTRAINT "Backorder_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCompletion" ADD CONSTRAINT "ServiceCompletion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCompletion" ADD CONSTRAINT "ServiceCompletion_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionTransition" ADD CONSTRAINT "SubscriptionTransition_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingScheduleItem" ADD CONSTRAINT "BillingScheduleItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealHealthAlert" ADD CONSTRAINT "DealHealthAlert_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealHealthAlert" ADD CONSTRAINT "DealHealthAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
