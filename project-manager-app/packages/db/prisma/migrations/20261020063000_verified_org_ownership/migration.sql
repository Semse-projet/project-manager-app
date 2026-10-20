-- Additive. No legacy owner assignment or modification of applied migrations.
CREATE UNIQUE INDEX "Org_id_tenantId_key" ON "Org"("id", "tenantId");
CREATE TABLE "OrgOwnership" (
  "orgId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "verifiedByUserId" TEXT NOT NULL,
  "evidenceRef" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ticket" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgOwnership_pkey" PRIMARY KEY ("orgId"),
  CONSTRAINT "OrgOwnership_orgId_tenantId_fkey" FOREIGN KEY ("orgId", "tenantId") REFERENCES "Org"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrgOwnership_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrgOwnership_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrgOwnership_tenantId_ownerUserId_idx" ON "OrgOwnership"("tenantId", "ownerUserId");

CREATE UNIQUE INDEX "OrgOwnership_orgId_tenantId_key" ON "OrgOwnership"("orgId", "tenantId");
