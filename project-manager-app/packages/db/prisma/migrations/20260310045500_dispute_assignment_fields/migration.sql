ALTER TABLE "Dispute"
ADD COLUMN "assigneeUserId" TEXT;

CREATE INDEX "Dispute_tenantId_assigneeUserId_idx" ON "Dispute"("tenantId", "assigneeUserId");

ALTER TABLE "Dispute"
ADD CONSTRAINT "Dispute_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
