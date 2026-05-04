ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'POSTED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'DISPUTE';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

DO $$
BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ACCEPTED', 'RELEASED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "budgetType" TEXT;

CREATE TABLE IF NOT EXISTS "JobReservation" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "professionalOrgId" TEXT,
  "professionalId" TEXT NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobReservation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "professionalOrgId" TEXT;
ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JobReservation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "Contract" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "clientOrgId" TEXT,
  "professionalOrgId" TEXT,
  "clientUserId" TEXT NOT NULL,
  "professionalUserId" TEXT NOT NULL,
  "termsJson" JSONB NOT NULL,
  "signedClientAt" TIMESTAMP(3),
  "signedProAt" TIMESTAMP(3),
  "pdfUrl" TEXT,
  "documentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientOrgId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "professionalOrgId" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "signedClientAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "signedProAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  ALTER TABLE "JobReservation"
    ADD CONSTRAINT "JobReservation_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "JobReservation"
    ADD CONSTRAINT "JobReservation_professionalOrgId_fkey"
    FOREIGN KEY ("professionalOrgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "JobReservation"
    ADD CONSTRAINT "JobReservation_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_clientOrgId_fkey"
    FOREIGN KEY ("clientOrgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_professionalOrgId_fkey"
    FOREIGN KEY ("professionalOrgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_clientUserId_fkey"
    FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_professionalUserId_fkey"
    FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "JobReservation_jobId_status_idx" ON "JobReservation"("jobId", "status");
CREATE INDEX IF NOT EXISTS "JobReservation_professionalId_status_idx" ON "JobReservation"("professionalId", "status");
CREATE INDEX IF NOT EXISTS "JobReservation_professionalOrgId_status_idx" ON "JobReservation"("professionalOrgId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_jobId_key" ON "Contract"("jobId");
CREATE INDEX IF NOT EXISTS "Contract_clientOrgId_idx" ON "Contract"("clientOrgId");
CREATE INDEX IF NOT EXISTS "Contract_professionalOrgId_idx" ON "Contract"("professionalOrgId");
