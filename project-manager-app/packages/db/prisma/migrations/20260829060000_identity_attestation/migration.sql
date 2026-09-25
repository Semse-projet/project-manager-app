-- CreateTable
CREATE TABLE "IdentityAttestation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verifiedByUserId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityAttestation_tenantId_userId_idx" ON "IdentityAttestation"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "IdentityAttestation" ADD CONSTRAINT "IdentityAttestation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
