-- CreateTable
CREATE TABLE "AgroFarm" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "operationType" TEXT NOT NULL DEFAULT 'LIVESTOCK',
    "locationLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroFarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroFarmUnit" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "areaValue" DECIMAL(12,4),
    "areaUnit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroFarmUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroAnimal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "currentUnitId" TEXT,
    "tagCode" TEXT,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "sex" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" TIMESTAMP(3),
    "estimatedAgeMonths" INTEGER,
    "initialWeight" DECIMAL(10,2),
    "currentWeight" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroAnimalGroup" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "currentUnitId" TEXT,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "averageWeight" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionCost" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroAnimalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroFarmTask" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "assignedToId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroFarmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroInventoryItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minimumStock" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroInventoryMovement" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL(12,4),
    "adjustmentDelta" DECIMAL(12,4),
    "unitCost" DECIMAL(12,4),
    "totalCost" DECIMAL(12,4),
    "relatedTaskId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroCostEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroEvidenceItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "mediaType" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "fileUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "capturedById" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroEvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroAuditEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgroFarm_ownerId_idx" ON "AgroFarm"("ownerId");

-- CreateIndex
CREATE INDEX "AgroFarmUnit_farmId_idx" ON "AgroFarmUnit"("farmId");

-- CreateIndex
CREATE INDEX "AgroAnimal_farmId_idx" ON "AgroAnimal"("farmId");

-- CreateIndex
CREATE INDEX "AgroAnimal_currentUnitId_idx" ON "AgroAnimal"("currentUnitId");

-- CreateIndex
CREATE INDEX "AgroAnimal_status_idx" ON "AgroAnimal"("status");

-- CreateIndex
CREATE INDEX "AgroAnimalGroup_farmId_idx" ON "AgroAnimalGroup"("farmId");

-- CreateIndex
CREATE INDEX "AgroAnimalGroup_currentUnitId_idx" ON "AgroAnimalGroup"("currentUnitId");

-- CreateIndex
CREATE INDEX "AgroAnimalGroup_status_idx" ON "AgroAnimalGroup"("status");

-- CreateIndex
CREATE INDEX "AgroFarmTask_farmId_idx" ON "AgroFarmTask"("farmId");

-- CreateIndex
CREATE INDEX "AgroFarmTask_status_idx" ON "AgroFarmTask"("status");

-- CreateIndex
CREATE INDEX "AgroFarmTask_assignedToId_idx" ON "AgroFarmTask"("assignedToId");

-- CreateIndex
CREATE INDEX "AgroFarmTask_dueAt_idx" ON "AgroFarmTask"("dueAt");

-- CreateIndex
CREATE INDEX "AgroInventoryItem_farmId_idx" ON "AgroInventoryItem"("farmId");

-- CreateIndex
CREATE INDEX "AgroInventoryItem_category_idx" ON "AgroInventoryItem"("category");

-- CreateIndex
CREATE INDEX "AgroInventoryMovement_farmId_idx" ON "AgroInventoryMovement"("farmId");

-- CreateIndex
CREATE INDEX "AgroInventoryMovement_itemId_idx" ON "AgroInventoryMovement"("itemId");

-- CreateIndex
CREATE INDEX "AgroInventoryMovement_occurredAt_idx" ON "AgroInventoryMovement"("occurredAt");

-- CreateIndex
CREATE INDEX "AgroCostEntry_farmId_idx" ON "AgroCostEntry"("farmId");

-- CreateIndex
CREATE INDEX "AgroCostEntry_occurredAt_idx" ON "AgroCostEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "AgroCostEntry_targetType_targetId_idx" ON "AgroCostEntry"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AgroEvidenceItem_farmId_idx" ON "AgroEvidenceItem"("farmId");

-- CreateIndex
CREATE INDEX "AgroEvidenceItem_entityType_entityId_idx" ON "AgroEvidenceItem"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AgroEvidenceItem_capturedAt_idx" ON "AgroEvidenceItem"("capturedAt");

-- CreateIndex
CREATE INDEX "AgroAuditEvent_farmId_idx" ON "AgroAuditEvent"("farmId");

-- CreateIndex
CREATE INDEX "AgroAuditEvent_entityType_entityId_idx" ON "AgroAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AgroAuditEvent_createdAt_idx" ON "AgroAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AgroAuditEvent_actorId_idx" ON "AgroAuditEvent"("actorId");

-- AddForeignKey
ALTER TABLE "AgroFarmUnit" ADD CONSTRAINT "AgroFarmUnit_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroAnimal" ADD CONSTRAINT "AgroAnimal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroAnimal" ADD CONSTRAINT "AgroAnimal_currentUnitId_fkey" FOREIGN KEY ("currentUnitId") REFERENCES "AgroFarmUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroAnimalGroup" ADD CONSTRAINT "AgroAnimalGroup_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroAnimalGroup" ADD CONSTRAINT "AgroAnimalGroup_currentUnitId_fkey" FOREIGN KEY ("currentUnitId") REFERENCES "AgroFarmUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroFarmTask" ADD CONSTRAINT "AgroFarmTask_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroInventoryItem" ADD CONSTRAINT "AgroInventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroInventoryMovement" ADD CONSTRAINT "AgroInventoryMovement_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroInventoryMovement" ADD CONSTRAINT "AgroInventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AgroInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCostEntry" ADD CONSTRAINT "AgroCostEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroEvidenceItem" ADD CONSTRAINT "AgroEvidenceItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroAuditEvent" ADD CONSTRAINT "AgroAuditEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
