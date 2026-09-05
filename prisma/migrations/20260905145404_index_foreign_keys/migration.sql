-- CreateIndex
CREATE INDEX "Allocation_orderLineId_idx" ON "Allocation"("orderLineId");

-- CreateIndex
CREATE INDEX "Allocation_planId_idx" ON "Allocation"("planId");

-- CreateIndex
CREATE INDEX "Allocation_warehouseId_idx" ON "Allocation"("warehouseId");

-- CreateIndex
CREATE INDEX "ApprovalStep_assigneeId_idx" ON "ApprovalStep"("assigneeId");

-- CreateIndex
CREATE INDEX "ApprovalStep_requestId_idx" ON "ApprovalStep"("requestId");

-- CreateIndex
CREATE INDEX "Backorder_orderLineId_idx" ON "Backorder"("orderLineId");

-- CreateIndex
CREATE INDEX "CreditApplication_creditNoteId_idx" ON "CreditApplication"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditApplication_invoiceId_idx" ON "CreditApplication"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_subscriptionId_idx" ON "CreditNote"("subscriptionId");

-- CreateIndex
CREATE INDEX "Customer_priceListId_idx" ON "Customer"("priceListId");

-- CreateIndex
CREATE INDEX "DealHealthAlert_orderId_idx" ON "DealHealthAlert"("orderId");

-- CreateIndex
CREATE INDEX "DealHealthAlert_quotationId_idx" ON "DealHealthAlert"("quotationId");

-- CreateIndex
CREATE INDEX "EntitlementValue_tierId_idx" ON "EntitlementValue"("tierId");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "NegotiationMessage_quotationId_idx" ON "NegotiationMessage"("quotationId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_productId_idx" ON "OrderLine"("productId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "PlanChangeNotice_tierId_idx" ON "PlanChangeNotice"("tierId");

-- CreateIndex
CREATE INDEX "PriceListItem_productId_idx" ON "PriceListItem"("productId");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "QuotationLine_planId_idx" ON "QuotationLine"("planId");

-- CreateIndex
CREATE INDEX "QuotationLine_productId_idx" ON "QuotationLine"("productId");

-- CreateIndex
CREATE INDEX "QuotationLine_quotationId_idx" ON "QuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "ReplenishmentPlan_warehouseId_idx" ON "ReplenishmentPlan"("warehouseId");

-- CreateIndex
CREATE INDEX "ServiceCompletion_orderId_idx" ON "ServiceCompletion"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_warehouseId_idx" ON "Shipment"("warehouseId");

-- CreateIndex
CREATE INDEX "ShipmentLine_orderLineId_idx" ON "ShipmentLine"("orderLineId");

-- CreateIndex
CREATE INDEX "ShipmentLine_shipmentId_idx" ON "ShipmentLine"("shipmentId");

-- CreateIndex
CREATE INDEX "StockLevel_productId_idx" ON "StockLevel"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_orderId_idx" ON "Subscription"("orderId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_productId_idx" ON "SubscriptionPlan"("productId");

-- CreateIndex
CREATE INDEX "SubscriptionTransition_subscriptionId_idx" ON "SubscriptionTransition"("subscriptionId");

-- CreateIndex
CREATE INDEX "UpsellRule_suggestedProductId_idx" ON "UpsellRule"("suggestedProductId");

-- CreateIndex
CREATE INDEX "User_customerId_idx" ON "User"("customerId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "VariantAttribute_productId_idx" ON "VariantAttribute"("productId");

-- CreateIndex
CREATE INDEX "VariantValue_attributeId_idx" ON "VariantValue"("attributeId");
