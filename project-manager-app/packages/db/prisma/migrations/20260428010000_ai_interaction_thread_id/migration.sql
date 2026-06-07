-- Add threadId to AiInteractionLog for cross-referencing by conversation
ALTER TABLE "AiInteractionLog" ADD COLUMN IF NOT EXISTS "threadId" TEXT;

-- Index for querying logs by conversation thread
CREATE INDEX IF NOT EXISTS "AiInteractionLog_threadId_idx" ON "AiInteractionLog"("threadId");
