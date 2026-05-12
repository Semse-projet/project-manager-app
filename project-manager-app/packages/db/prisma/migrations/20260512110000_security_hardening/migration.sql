-- Enforce one active milestone sequence per project while preserving soft-delete reuse.
CREATE UNIQUE INDEX IF NOT EXISTS "milestone_project_sequence_active_unique"
ON "Milestone"("projectId", "sequence")
WHERE "deletedAt" IS NULL;

-- Job.scopeSnapshot is the accepted-contract snapshot. Once set, it must not be mutated.
CREATE OR REPLACE FUNCTION "prevent_job_scope_snapshot_update"()
RETURNS trigger AS $$
BEGIN
  IF OLD."scopeSnapshot" IS NOT NULL
     AND NEW."scopeSnapshot" IS DISTINCT FROM OLD."scopeSnapshot" THEN
    RAISE EXCEPTION 'Job.scopeSnapshot is immutable once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "job_scope_snapshot_immutable" ON "Job";

CREATE TRIGGER "job_scope_snapshot_immutable"
BEFORE UPDATE OF "scopeSnapshot" ON "Job"
FOR EACH ROW
EXECUTE FUNCTION "prevent_job_scope_snapshot_update"();
