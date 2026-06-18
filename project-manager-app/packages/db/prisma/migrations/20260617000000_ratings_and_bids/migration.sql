-- ── Bid: add professionalUserId column ───────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bid' AND column_name = 'professionalUserId'
  ) THEN
    ALTER TABLE "Bid" ADD COLUMN "professionalUserId" TEXT NOT NULL DEFAULT '';
    CREATE INDEX "Bid_professionalUserId_status_idx" ON "Bid"("professionalUserId", "status");
    ALTER TABLE "Bid" ADD CONSTRAINT "Bid_professionalUserId_fkey"
      FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Bid: jobId+status index (idempotent) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Bid_jobId_status_idx" ON "Bid"("jobId", "status");

-- ── Rating table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Rating" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Rating_jobId_createdAt_idx" ON "Rating"("jobId", "createdAt");
CREATE INDEX IF NOT EXISTS "Rating_fromUserId_createdAt_idx" ON "Rating"("fromUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "Rating_toUserId_createdAt_idx" ON "Rating"("toUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Rating_jobId_fkey'
  ) THEN
    ALTER TABLE "Rating" ADD CONSTRAINT "Rating_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Rating_fromUserId_fkey'
  ) THEN
    ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromUserId_fkey"
      FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Rating_toUserId_fkey'
  ) THEN
    ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
