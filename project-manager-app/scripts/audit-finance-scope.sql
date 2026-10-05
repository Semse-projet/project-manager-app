-- psql -v tenant_id=<AUTHORIZED_TENANT> -f scripts/audit-finance-scope.sql
-- Read-only counts; does not expose financial amounts or change legacy data.
BEGIN TRANSACTION READ ONLY;

SELECT 'invoice_invalid_project' AS check_name, count(*) AS rows
FROM "Invoice" i LEFT JOIN "Project" p ON p.id = i."projectId" AND p."tenantId" = i."tenantId"
WHERE i."tenantId" = :'tenant_id' AND i."projectId" IS NOT NULL AND p.id IS NULL;

SELECT 'invoice_project_job_mismatch' AS check_name, count(*) AS rows
FROM "Invoice" i JOIN "Project" p ON p.id = i."projectId" AND p."tenantId" = i."tenantId"
WHERE i."tenantId" = :'tenant_id' AND i."jobId" IS NOT NULL AND i."jobId" IS DISTINCT FROM p."jobId";

SELECT 'expense_invalid_or_deleted_milestone' AS check_name, count(*) AS rows
FROM "ProjectExpense" e
LEFT JOIN "Milestone" m ON m.id = e."milestoneId" AND m."deletedAt" IS NULL
LEFT JOIN "Project" p ON p.id = m."projectId" AND p."tenantId" = e."tenantId"
WHERE e."tenantId" = :'tenant_id' AND e."milestoneId" IS NOT NULL
  AND (p.id IS NULL OR e."projectId" IS DISTINCT FROM m."projectId");

SELECT 'expense_invoice_tenant_or_scope_mismatch' AS check_name, count(*) AS rows
FROM "ProjectExpense" e LEFT JOIN "Invoice" i ON i.id = e."invoiceId" AND i."tenantId" = e."tenantId"
WHERE e."tenantId" = :'tenant_id' AND e."invoiceId" IS NOT NULL
  AND (i.id IS NULL OR (i."projectId" IS NOT NULL AND e."projectId" IS DISTINCT FROM i."projectId")
    OR (i."jobId" IS NOT NULL AND e."jobId" IS DISTINCT FROM i."jobId"));

SELECT 'expense_project_job_mismatch' AS check_name, count(*) AS rows
FROM "ProjectExpense" e JOIN "Project" p ON p.id = e."projectId" AND p."tenantId" = e."tenantId"
WHERE e."tenantId" = :'tenant_id' AND e."jobId" IS NOT NULL AND e."jobId" IS DISTINCT FROM p."jobId";

SELECT 'duplicate_reference_outside_scope' AS check_name, count(*) AS rows
FROM "ProjectExpense" e LEFT JOIN "ProjectExpense" d ON d.id = e."duplicateOfId"
WHERE e."tenantId" = :'tenant_id' AND e."duplicateOfId" IS NOT NULL
  AND (d.id IS NULL OR d."tenantId" IS DISTINCT FROM e."tenantId" OR d."orgId" IS DISTINCT FROM e."orgId"
    OR d."projectId" IS DISTINCT FROM e."projectId" OR d."jobId" IS DISTINCT FROM e."jobId"
    OR d.currency IS DISTINCT FROM e.currency);

COMMIT;
