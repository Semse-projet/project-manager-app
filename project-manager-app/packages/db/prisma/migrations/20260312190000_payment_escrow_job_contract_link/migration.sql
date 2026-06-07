ALTER TABLE "PaymentEscrow" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "PaymentEscrow" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

UPDATE "PaymentEscrow" AS pe
SET "jobId" = p."jobId"
FROM "Project" AS p
WHERE pe."projectId" = p."id"
  AND pe."jobId" IS NULL;

UPDATE "PaymentEscrow" AS pe
SET "contractId" = c."id"
FROM "Contract" AS c
WHERE pe."jobId" = c."jobId"
  AND pe."contractId" IS NULL;

DO $$
BEGIN
  ALTER TABLE "PaymentEscrow"
    ADD CONSTRAINT "PaymentEscrow_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PaymentEscrow"
    ADD CONSTRAINT "PaymentEscrow_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEscrow_jobId_key" ON "PaymentEscrow"("jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEscrow_contractId_key" ON "PaymentEscrow"("contractId");
