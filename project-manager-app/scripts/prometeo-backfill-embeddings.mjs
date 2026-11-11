#!/usr/bin/env node
/**
 * LEGACY EMBEDDING BACKFILL — DISABLED BY DEFAULT, FAIL CLOSED.
 *
 * The former version selected all indexed documents (including unconsented
 * field_observation/PROMOTED/public_training originals) and posted chunk text
 * directly to an external embeddings endpoint when OPENAI_API_KEY existed.
 * A tenant filter, --dry-run, a legacy label or possession of a key is NOT
 * an authorization to export a document to a third party.
 *
 * Retirement is deliberate until an independently reviewed replacement has:
 *  - explicit tenant + owner/rights-holder consent per document version;
 *  - read-time org/project/grant/revocation verification for each chunk;
 *  - a VERIFIED local-only embedding backend and no external network fallback;
 *  - bounded batches, idempotent retries, audit/rollback and safe test fixtures;
 *  - a documented operational approval and reproducible egress proof.
 *
 * No database client, document text or network connection is created here,
 * regardless of CLI flags, credentials, environment or historical labels.
 * Do not replace this guard with a permissive --force flag.
 */

console.error(
  "[PROMETEO_L14_BACKFILL_DISABLED] Legacy cloud embeddings backfill is " +
  "quarantined. No documents were read or changed; no API calls were made. " +
  "Use the approved scoped/local-only replacement after privacy, CI, " +
  "rollback and human review. --dry-run and --tenant do not bypass this gate."
);
process.exitCode = 1;
