-- Agro F2: Mixed FarmOps — ProductionCycle, CropCycle, InputApplication,
--          HarvestRecord, TraceabilityEvent, ComplianceCheck

CREATE TABLE "AgroProductionCycle" (
    "id"           TEXT NOT NULL,
    "farmId"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "cycleType"    TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate"    TIMESTAMP(3) NOT NULL,
    "endDate"      TIMESTAMP(3),
    "notes"        TEXT,
    "metadataJson" JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroProductionCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgroCropCycle" (
    "id"                  TEXT NOT NULL,
    "farmId"              TEXT NOT NULL,
    "productionCycleId"   TEXT,
    "cropName"            TEXT NOT NULL,
    "cropVariety"         TEXT,
    "fieldUnitId"         TEXT,
    "status"              TEXT NOT NULL DEFAULT 'PLANNED',
    "sowingDate"          TIMESTAMP(3),
    "expectedHarvestDate" TIMESTAMP(3),
    "actualHarvestDate"   TIMESTAMP(3),
    "areaHectares"        DECIMAL(12,4),
    "seedQuantityKg"      DECIMAL(12,4),
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroCropCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgroInputApplication" (
    "id"              TEXT NOT NULL,
    "farmId"          TEXT NOT NULL,
    "cropCycleId"     TEXT,
    "inventoryItemId" TEXT,
    "inputType"       TEXT NOT NULL,
    "productName"     TEXT NOT NULL,
    "quantity"        DECIMAL(12,4) NOT NULL,
    "unit"            TEXT NOT NULL,
    "appliedAt"       TIMESTAMP(3) NOT NULL,
    "appliedByUserId" TEXT,
    "fieldUnitId"     TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroInputApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgroHarvestRecord" (
    "id"              TEXT NOT NULL,
    "farmId"          TEXT NOT NULL,
    "cropCycleId"     TEXT,
    "harvestedAt"     TIMESTAMP(3) NOT NULL,
    "quantityKg"      DECIMAL(12,4) NOT NULL,
    "qualityGrade"    TEXT,
    "storageLocation" TEXT,
    "destinationType" TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroHarvestRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgroTraceabilityEvent" (
    "id"                  TEXT NOT NULL,
    "farmId"              TEXT NOT NULL,
    "productionCycleId"   TEXT,
    "entityType"          TEXT NOT NULL,
    "entityId"            TEXT NOT NULL,
    "eventType"           TEXT NOT NULL,
    "description"         TEXT NOT NULL,
    "occurredAt"          TIMESTAMP(3) NOT NULL,
    "latitude"            DECIMAL(10,7),
    "longitude"           DECIMAL(10,7),
    "evidenceUrls"        JSONB,
    "verifiedBy"          TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroTraceabilityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgroComplianceCheck" (
    "id"           TEXT NOT NULL,
    "farmId"       TEXT NOT NULL,
    "checkType"    TEXT NOT NULL,
    "entityType"   TEXT,
    "entityId"     TEXT,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate"      TIMESTAMP(3),
    "completedAt"  TIMESTAMP(3),
    "notes"        TEXT,
    "evidenceUrls" JSONB,
    "reviewedBy"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- FK constraints
ALTER TABLE "AgroProductionCycle"  ADD CONSTRAINT "AgroProductionCycle_farmId_fkey"        FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;
ALTER TABLE "AgroCropCycle"        ADD CONSTRAINT "AgroCropCycle_farmId_fkey"               FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;
ALTER TABLE "AgroCropCycle"        ADD CONSTRAINT "AgroCropCycle_productionCycleId_fkey"    FOREIGN KEY ("productionCycleId")  REFERENCES "AgroProductionCycle"("id")  ON DELETE SET NULL;
ALTER TABLE "AgroCropCycle"        ADD CONSTRAINT "AgroCropCycle_fieldUnitId_fkey"          FOREIGN KEY ("fieldUnitId")        REFERENCES "AgroFarmUnit"("id")         ON DELETE SET NULL;
ALTER TABLE "AgroInputApplication" ADD CONSTRAINT "AgroInputApplication_farmId_fkey"        FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;
ALTER TABLE "AgroInputApplication" ADD CONSTRAINT "AgroInputApplication_cropCycleId_fkey"   FOREIGN KEY ("cropCycleId")        REFERENCES "AgroCropCycle"("id")        ON DELETE SET NULL;
ALTER TABLE "AgroHarvestRecord"    ADD CONSTRAINT "AgroHarvestRecord_farmId_fkey"           FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;
ALTER TABLE "AgroHarvestRecord"    ADD CONSTRAINT "AgroHarvestRecord_cropCycleId_fkey"      FOREIGN KEY ("cropCycleId")        REFERENCES "AgroCropCycle"("id")        ON DELETE SET NULL;
ALTER TABLE "AgroTraceabilityEvent" ADD CONSTRAINT "AgroTraceabilityEvent_farmId_fkey"      FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;
ALTER TABLE "AgroTraceabilityEvent" ADD CONSTRAINT "AgroTraceabilityEvent_productionCycleId_fkey" FOREIGN KEY ("productionCycleId") REFERENCES "AgroProductionCycle"("id") ON DELETE SET NULL;
ALTER TABLE "AgroComplianceCheck"  ADD CONSTRAINT "AgroComplianceCheck_farmId_fkey"         FOREIGN KEY ("farmId")             REFERENCES "AgroFarm"("id")             ON DELETE CASCADE;

-- Indexes
CREATE INDEX "AgroProductionCycle_farmId_status_idx"   ON "AgroProductionCycle"("farmId", "status");
CREATE INDEX "AgroCropCycle_farmId_status_idx"         ON "AgroCropCycle"("farmId", "status");
CREATE INDEX "AgroInputApplication_farmId_idx"         ON "AgroInputApplication"("farmId");
CREATE INDEX "AgroInputApplication_cropCycleId_idx"    ON "AgroInputApplication"("cropCycleId");
CREATE INDEX "AgroHarvestRecord_farmId_idx"            ON "AgroHarvestRecord"("farmId");
CREATE INDEX "AgroHarvestRecord_cropCycleId_idx"       ON "AgroHarvestRecord"("cropCycleId");
CREATE INDEX "AgroTraceabilityEvent_farmId_idx"        ON "AgroTraceabilityEvent"("farmId");
CREATE INDEX "AgroTraceabilityEvent_entityType_entityId_idx" ON "AgroTraceabilityEvent"("entityType", "entityId");
CREATE INDEX "AgroTraceabilityEvent_productionCycleId_idx"   ON "AgroTraceabilityEvent"("productionCycleId");
CREATE INDEX "AgroComplianceCheck_farmId_status_idx"   ON "AgroComplianceCheck"("farmId", "status");
CREATE INDEX "AgroComplianceCheck_farmId_checkType_idx" ON "AgroComplianceCheck"("farmId", "checkType");
