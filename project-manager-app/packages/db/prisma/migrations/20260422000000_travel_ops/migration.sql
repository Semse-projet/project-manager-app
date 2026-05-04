-- Travel Ops / Movilidad y Estancia
-- Adds isOutOfTown flag to Job and five travel domain models.

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "isOutOfTown"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "destinationCity" TEXT;

-- TravelAssignment
CREATE TABLE "TravelAssignment" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "jobId"             TEXT NOT NULL,
  "assignedTo"        TEXT NOT NULL,
  "destinationCity"   TEXT NOT NULL,
  "departureDate"     TIMESTAMP(3) NOT NULL,
  "returnDate"        TIMESTAMP(3),
  "estimatedDays"     INTEGER,
  "requiresLodging"   BOOLEAN NOT NULL DEFAULT true,
  "headcount"         INTEGER NOT NULL DEFAULT 1,
  "mainTransportMode" TEXT,
  "approvedBudget"    DECIMAL(12,2),
  "approvedBy"        TEXT,
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelAssignment_tenantId_jobId_idx"            ON "TravelAssignment"("tenantId","jobId");
CREATE INDEX "TravelAssignment_tenantId_assignedTo_status_idx" ON "TravelAssignment"("tenantId","assignedTo","status");
CREATE INDEX "TravelAssignment_tenantId_status_idx"           ON "TravelAssignment"("tenantId","status");
ALTER TABLE "TravelAssignment" ADD CONSTRAINT "TravelAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TravelExpense
CREATE TABLE "TravelExpense" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "travelId"     TEXT NOT NULL,
  "submittedBy"  TEXT NOT NULL,
  "category"     TEXT NOT NULL,
  "subcategory"  TEXT,
  "description"  TEXT,
  "amount"       DECIMAL(12,2) NOT NULL,
  "currency"     TEXT NOT NULL DEFAULT 'USD',
  "expenseDate"  TIMESTAMP(3) NOT NULL,
  "city"         TEXT,
  "origin"       TEXT,
  "destination"  TEXT,
  "vendor"       TEXT,
  "odometer"     DECIMAL(10,2),
  "gallons"      DECIMAL(8,3),
  "receiptUrl"   TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy"   TEXT,
  "approvedAt"   TIMESTAMP(3),
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelExpense_tenantId_travelId_status_idx" ON "TravelExpense"("tenantId","travelId","status");
CREATE INDEX "TravelExpense_tenantId_submittedBy_idx"      ON "TravelExpense"("tenantId","submittedBy");
CREATE INDEX "TravelExpense_tenantId_category_idx"         ON "TravelExpense"("tenantId","category");
ALTER TABLE "TravelExpense" ADD CONSTRAINT "TravelExpense_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelExpense" ADD CONSTRAINT "TravelExpense_travelId_fkey"
  FOREIGN KEY ("travelId") REFERENCES "TravelAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LodgingBooking
CREATE TABLE "LodgingBooking" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "travelId"         TEXT NOT NULL,
  "type"             TEXT NOT NULL DEFAULT 'hotel',
  "name"             TEXT NOT NULL,
  "address"          TEXT,
  "checkIn"          TIMESTAMP(3) NOT NULL,
  "checkOut"         TIMESTAMP(3) NOT NULL,
  "costPerNight"     DECIMAL(12,2),
  "estimatedTotal"   DECIMAL(12,2),
  "actualTotal"      DECIMAL(12,2),
  "confirmationCode" TEXT,
  "paidBy"           TEXT,
  "status"           TEXT NOT NULL DEFAULT 'RESERVED',
  "receiptUrl"       TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LodgingBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LodgingBooking_tenantId_travelId_idx" ON "LodgingBooking"("tenantId","travelId");
CREATE INDEX "LodgingBooking_tenantId_status_idx"   ON "LodgingBooking"("tenantId","status");
ALTER TABLE "LodgingBooking" ADD CONSTRAINT "LodgingBooking_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LodgingBooking" ADD CONSTRAINT "LodgingBooking_travelId_fkey"
  FOREIGN KEY ("travelId") REFERENCES "TravelAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TravelAdvance
CREATE TABLE "TravelAdvance" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "travelId"   TEXT NOT NULL,
  "issuedTo"   TEXT NOT NULL,
  "amount"     DECIMAL(12,2) NOT NULL,
  "currency"   TEXT NOT NULL DEFAULT 'USD',
  "method"     TEXT,
  "issuedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedBy" TEXT,
  "purpose"    TEXT,
  "status"     TEXT NOT NULL DEFAULT 'ISSUED',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelAdvance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelAdvance_tenantId_travelId_idx" ON "TravelAdvance"("tenantId","travelId");
CREATE INDEX "TravelAdvance_tenantId_issuedTo_idx" ON "TravelAdvance"("tenantId","issuedTo");
ALTER TABLE "TravelAdvance" ADD CONSTRAINT "TravelAdvance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelAdvance" ADD CONSTRAINT "TravelAdvance_travelId_fkey"
  FOREIGN KEY ("travelId") REFERENCES "TravelAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TravelSettlement
CREATE TABLE "TravelSettlement" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "travelId"       TEXT NOT NULL,
  "approvedBudget" DECIMAL(12,2),
  "totalAdvances"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalLodging"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalMeals"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalTransport" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalOther"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalSpent"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDue"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"          TEXT,
  "closedBy"       TEXT,
  "closedAt"       TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TravelSettlement_travelId_key" ON "TravelSettlement"("travelId");
CREATE INDEX "TravelSettlement_tenantId_status_idx" ON "TravelSettlement"("tenantId","status");
ALTER TABLE "TravelSettlement" ADD CONSTRAINT "TravelSettlement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelSettlement" ADD CONSTRAINT "TravelSettlement_travelId_fkey"
  FOREIGN KEY ("travelId") REFERENCES "TravelAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
