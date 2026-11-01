-- F1A additive defense: PostgreSQL TIMESTAMP accepts +/-infinity.
-- All consent validity boundaries must be representable finite instants.
-- This fails closed if a pre-existing row uses non-finite timestamps.
-- DO NOT rewrite any previously applied migration.
ALTER TABLE "CuratedPublicationConsent"
  ADD CONSTRAINT "CuratedPublicationConsent_finite_timestamps"
  CHECK (
    isfinite("expiresAt")
    AND isfinite("grantedAt")
    AND ("withdrawnAt" IS NULL OR isfinite("withdrawnAt"))
  );
