-- Immutable, unique replay claims for signature-provider webhooks.
-- Must be committed in the same database transaction as business effects.
CREATE TABLE IF NOT EXISTS signature_event_claims (
  replay_key CHAR(64) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT signature_event_claims_hex CHECK (replay_key ~ '^[a-f0-9]{64}$')
);
