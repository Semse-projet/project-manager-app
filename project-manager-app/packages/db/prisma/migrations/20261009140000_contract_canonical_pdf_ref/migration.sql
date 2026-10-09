-- Additive, no backfill of historical self-attested PDF URLs/hashes.
-- The value is owned by the server-side seal flow and references immutable
-- private storage; it MUST NOT become a public uploaded-file URL.
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "canonicalPdfRef" TEXT;
