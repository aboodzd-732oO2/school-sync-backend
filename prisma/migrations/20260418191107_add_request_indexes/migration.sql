-- CreateIndex
CREATE INDEX "Request_institutionId_idx" ON "Request"("institutionId");

-- CreateIndex
CREATE INDEX "Request_warehouseId_idx" ON "Request"("warehouseId");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");
