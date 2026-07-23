-- Labor Engine idempotency: let the client-generated Time Tracker event id
-- act as a real idempotency key for TimeEntry creation, so a retried
-- "start timer" / "manual entry" sync (after a partial-batch failure or a
-- lost response) resolves to the existing row instead of inserting a
-- duplicate payable entry.

ALTER TABLE "TimeEntry" ADD COLUMN "clientEventId" TEXT;

-- NULLs are not considered equal by a unique index in Postgres, so existing
-- rows (all NULL clientEventId) and any future entry created outside the
-- offline-safe queue are unaffected by this constraint.
CREATE UNIQUE INDEX "TimeEntry_tenantId_createdBy_clientEventId_key"
    ON "TimeEntry"("tenantId", "createdBy", "clientEventId");
