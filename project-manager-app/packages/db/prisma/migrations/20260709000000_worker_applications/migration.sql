-- Worker Onboarding — aplicaciones públicas de trabajadores (/worker/apply)

-- CreateTable
CREATE TABLE "WorkerApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "trade" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "message" TEXT,
    "proposedRate" DECIMAL(10,2),
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdUserId" TEXT,
    "sessionToken" TEXT,
    "sourceChannel" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerApplication_tenantId_status_createdAt_idx" ON "WorkerApplication"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerApplication_tenantId_email_idx" ON "WorkerApplication"("tenantId", "email");
