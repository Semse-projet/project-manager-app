CREATE UNIQUE INDEX IF NOT EXISTS "JobReservation_one_active_per_job"
  ON "JobReservation" ("jobId")
  WHERE status = 'ACTIVE';
