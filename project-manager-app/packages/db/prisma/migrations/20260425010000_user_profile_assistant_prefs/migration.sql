-- AlterTable: UserProfile — add assistant AI preferences
ALTER TABLE "UserProfile"
  ADD COLUMN IF NOT EXISTS "assistantTone"      TEXT,
  ADD COLUMN IF NOT EXISTS "assistantLanguage"  TEXT,
  ADD COLUMN IF NOT EXISTS "assistantVerbosity" TEXT,
  ADD COLUMN IF NOT EXISTS "unifiedMode"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expertMode"         BOOLEAN NOT NULL DEFAULT false;
