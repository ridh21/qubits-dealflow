-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_riskBand_createdAt_idx" ON "ApprovalRequest"("riskBand", "createdAt");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_confirmedAt_idx" ON "Order"("fulfillmentStatus", "confirmedAt");

-- CreateIndex
CREATE INDEX "Order_status_confirmedAt_idx" ON "Order"("status", "confirmedAt");

-- CreateIndex
CREATE INDEX "Order_customerId_confirmedAt_idx" ON "Order"("customerId", "confirmedAt");
