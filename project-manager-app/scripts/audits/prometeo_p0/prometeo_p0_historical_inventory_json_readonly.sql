-- SEMSE #974 / C51: inventory returns ONE JSON object of aggregate counts.
-- No raw documents, chunks, user IDs, titles, emails, notes or vector data.
-- Requires explicitly authorized read-only credentials and a private route.
-- Do NOT run automatically in CI; this query targets the historical dataset.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

WITH
documents AS (
SELECT
    COUNT(*)::bigint AS documents_total,
    COUNT(*) FILTER (WHERE d."status" = 'indexed')::bigint AS indexed_documents,
    COUNT(*) FILTER (WHERE d."projectId" IS NULL)::bigint AS without_project,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(d."orgId"), '') IS NULL)::bigint AS blank_owner_org,
    COUNT(*) FILTER (WHERE o."id" IS NULL)::bigint AS owner_org_not_in_tenant,
    COUNT(*) FILTER (WHERE d."projectId" IS NOT NULL AND p."id" IS NULL)::bigint AS project_missing_in_tenant,
    COUNT(*) FILTER (WHERE d."projectId" IS NOT NULL AND (p."id" IS NULL OR j."id" IS NULL))::bigint AS project_or_job_missing_in_tenant,
    COUNT(*) FILTER (WHERE p."id" IS NOT NULL AND j."id" IS NOT NULL
        AND d."orgId" <> j."clientOrgId"
        AND d."orgId" <> p."assignedProOrgId")::bigint AS owner_not_project_participant,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' = 'public_training')::bigint AS legacy_public_training,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' = 'tenant_private')::bigint AS tenant_private_labels,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' = 'project_private')::bigint AS project_private_labels,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' = 'tenant_private'
        AND d."projectId" IS NOT NULL)::bigint AS tenant_private_with_project,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' = 'project_private'
        AND d."projectId" IS NULL)::bigint AS project_private_without_project,
    COUNT(*) FILTER (WHERE d."metadataJson" IS NULL
        OR jsonb_typeof(d."metadataJson") <> 'object'
        OR NOT (d."metadataJson" ? 'visibility')
        OR d."metadataJson" ->> 'visibility' IS NULL)::bigint AS missing_visibility_metadata,
    COUNT(*) FILTER (WHERE d."metadataJson" ->> 'visibility' IS NOT NULL
        AND d."metadataJson" ->> 'visibility' NOT IN
          ('public_training', 'tenant_private', 'project_private'))::bigint AS unexpected_visibility_label
FROM "PrometeoDocument" d
LEFT JOIN "Org" o ON o."id" = d."orgId" AND o."tenantId" = d."tenantId"
LEFT JOIN "Project" p ON p."id" = d."projectId" AND p."tenantId" = d."tenantId"
LEFT JOIN "Job" j ON j."id" = p."jobId" AND j."tenantId" = d."tenantId"
),
grants AS (
SELECT
    COUNT(*)::bigint AS grants_total,
    COUNT(*) FILTER (WHERE g."revokedAt" IS NULL)::bigint AS grants_active,
    COUNT(*) FILTER (WHERE g."revokedAt" IS NOT NULL)::bigint AS grants_revoked,
    COUNT(*) FILTER (WHERE d."id" IS NULL)::bigint AS grant_missing_document,
    COUNT(*) FILTER (WHERE recipient."id" IS NULL)::bigint AS recipient_not_in_tenant,
    COUNT(*) FILTER (WHERE d."id" IS NOT NULL AND
        (d."tenantId" <> g."tenantId" OR d."projectId" IS DISTINCT FROM g."projectId"))::bigint AS grant_document_scope_mismatch,
    COUNT(*) FILTER (WHERE g."revokedAt" IS NULL AND
        (p."id" IS NULL OR j."id" IS NULL OR d."id" IS NULL
         OR g."recipientOrgId" NOT IN (j."clientOrgId", p."assignedProOrgId")
         OR d."orgId" NOT IN (j."clientOrgId", p."assignedProOrgId")
         OR g."recipientOrgId" = d."orgId"))::bigint AS active_grants_failing_project_participants
FROM "PrometeoDocumentGrant" g
LEFT JOIN "PrometeoDocument" d ON d."id" = g."documentId"
LEFT JOIN "Org" recipient ON recipient."id" = g."recipientOrgId"
    AND recipient."tenantId" = g."tenantId"
LEFT JOIN "Project" p ON p."id" = g."projectId" AND p."tenantId" = g."tenantId"
LEFT JOIN "Job" j ON j."id" = p."jobId" AND j."tenantId" = g."tenantId"
),
chunks AS (
SELECT
    COUNT(*)::bigint AS chunks_total,
    COUNT(*) FILTER (WHERE d."id" IS NULL)::bigint AS orphan_chunks,
    COUNT(*) FILTER (WHERE d."id" IS NOT NULL
        AND c."tenantId" <> d."tenantId")::bigint AS chunk_tenant_mismatch,
    COUNT(*) FILTER (WHERE c."tokenCount" < 0)::bigint AS negative_token_count
FROM "DocumentChunk" c
LEFT JOIN "PrometeoDocument" d ON d."id" = c."documentId"
),
feedback AS (
SELECT
    COUNT(*)::bigint AS feedback_total,
    COUNT(*) FILTER (WHERE c."id" IS NULL)::bigint AS orphan_feedback_chunk,
    COUNT(*) FILTER (WHERE c."id" IS NOT NULL AND
        (f."tenantId" <> c."tenantId" OR f."documentId" <> c."documentId"))::bigint
        AS feedback_tenant_or_document_mismatch
FROM "PrometeoChunkFeedback" f
LEFT JOIN "DocumentChunk" c ON c."id" = f."chunkId"
),
audits AS (
SELECT
    "action",
    COUNT(*)::bigint AS events
FROM "AuditLog"
WHERE "action" IN (
    'prometeo.document_share_granted',
    'prometeo.document_share_revoked',
    'prometeo.document_share_revoked_by_delete'
)
GROUP BY "action"
ORDER BY "action"
),
audit_event_object AS (
    SELECT COALESCE(jsonb_object_agg("action", events), '{}'::jsonb) AS value
    FROM audits
)
SELECT jsonb_build_object(
  'source_kind', 'authorized_postgresql_aggregate_inventory',
  'snapshot_utc', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'documents', (SELECT to_jsonb(d) FROM documents d),
  'grants', (SELECT to_jsonb(g) FROM grants g),
  'chunks', (SELECT to_jsonb(c) FROM chunks c),
  'feedback', (SELECT to_jsonb(f) FROM feedback f),
  'audit_events', (SELECT value FROM audit_event_object)
)::text AS p0_history_inventory_json;

ROLLBACK;
