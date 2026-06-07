-- Convert PaymentEscrow.status from free text to a Prisma enum without
-- silently rewriting unexpected production data.

DO $$
DECLARE
  invalid_statuses text;
BEGIN
  SELECT string_agg(DISTINCT "status", ', ' ORDER BY "status")
    INTO invalid_statuses
  FROM "PaymentEscrow"
  WHERE lower("status") NOT IN (
    'active',
    'pending_settlement',
    'pending-settlement',
    'closed',
    'cancelled',
    'released'
  );

  IF invalid_statuses IS NOT NULL THEN
    RAISE EXCEPTION 'Unsupported PaymentEscrow.status values before enum migration: %', invalid_statuses;
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE "EscrowStatus" AS ENUM (
    'active',
    'pending_settlement',
    'closed',
    'cancelled',
    'released'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PaymentEscrow"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "PaymentEscrow"
  ALTER COLUMN "status" TYPE "EscrowStatus"
  USING (
    CASE
      WHEN lower("status") = 'pending-settlement' THEN 'pending_settlement'
      ELSE lower("status")
    END
  )::"EscrowStatus";

ALTER TABLE "PaymentEscrow"
  ALTER COLUMN "status" SET DEFAULT 'active';
