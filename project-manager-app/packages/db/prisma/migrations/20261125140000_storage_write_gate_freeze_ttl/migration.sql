-- T-008 production-control slice: freeze deadline only.
-- Additive. Does not provision a gate, change phase, or auto-thaw.
-- A past freezeExpiresAt does not reopen writes.
ALTER TABLE "StorageWriteGate"
  ADD COLUMN IF NOT EXISTS "freezeExpiresAt" TIMESTAMP(3);
