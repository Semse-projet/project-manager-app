-- Lien* existen en prod desde el baseline P3005 pero ninguna migración las
-- creaba: un entorno nuevo desde migraciones no las tenía (hallazgo PI-01).
-- IF NOT EXISTS: no-op en prod, creación real en entornos frescos.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LienCalendar" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "preliminaryNoticeDeadline" TIMESTAMP(3) NOT NULL,
    "waiverDeadline" TIMESTAMP(3) NOT NULL,
    "finalNoticeDeadline" TIMESTAMP(3),
    "statusLienDeadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "requiresNotary" BOOLEAN NOT NULL DEFAULT false,
    "requiresCertifiedMail" BOOLEAN NOT NULL DEFAULT true,
    "liengridResponseJson" JSONB,
    "lastFetchedAt" TIMESTAMP(3),
    "fetchRetryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LienCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LienNotice" (
    "id" TEXT NOT NULL,
    "lienCalendarId" TEXT NOT NULL,
    "noticeType" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "noticeContent" TEXT NOT NULL,
    "sentVia" TEXT NOT NULL,
    "lobLetterTrackingId" TEXT,
    "lobLetterUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliveredAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LienNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LienWaiver" (
    "id" TEXT NOT NULL,
    "lienCalendarId" TEXT NOT NULL,
    "escrowId" TEXT,
    "milestoneId" TEXT,
    "waiverType" TEXT NOT NULL,
    "releaseAmount" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signingUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signature" TEXT,
    "signedBy" TEXT,
    "requiredBefore" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LienWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienCalendar_projectId_idx" ON "LienCalendar"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienCalendar_status_idx" ON "LienCalendar"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienCalendar_preliminaryNoticeDeadline_idx" ON "LienCalendar"("preliminaryNoticeDeadline");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LienCalendar_projectId_stateName_key" ON "LienCalendar"("projectId", "stateName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienNotice_lienCalendarId_idx" ON "LienNotice"("lienCalendarId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienNotice_status_idx" ON "LienNotice"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienNotice_sentAt_idx" ON "LienNotice"("sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienWaiver_lienCalendarId_idx" ON "LienWaiver"("lienCalendarId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienWaiver_status_idx" ON "LienWaiver"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LienWaiver_requiredBefore_idx" ON "LienWaiver"("requiredBefore");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LienCalendar_projectId_fkey') THEN
        -- AddForeignKey
ALTER TABLE "LienCalendar" ADD CONSTRAINT "LienCalendar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LienNotice_lienCalendarId_fkey') THEN
        -- AddForeignKey
ALTER TABLE "LienNotice" ADD CONSTRAINT "LienNotice_lienCalendarId_fkey" FOREIGN KEY ("lienCalendarId") REFERENCES "LienCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LienWaiver_lienCalendarId_fkey') THEN
        -- AddForeignKey
ALTER TABLE "LienWaiver" ADD CONSTRAINT "LienWaiver_lienCalendarId_fkey" FOREIGN KEY ("lienCalendarId") REFERENCES "LienCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
