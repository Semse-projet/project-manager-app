-- AlterTable: add HelloSign signing fields to Contract
ALTER TABLE "Contract"
    ADD COLUMN IF NOT EXISTS "helloSignRequestId" TEXT,
    ADD COLUMN IF NOT EXISTS "signingUrlClient" TEXT,
    ADD COLUMN IF NOT EXISTS "signingUrlPro" TEXT;

-- CreateIndex for lookups by helloSignRequestId (webhooks)
CREATE INDEX IF NOT EXISTS "Contract_helloSignRequestId_idx" ON "Contract"("helloSignRequestId");
