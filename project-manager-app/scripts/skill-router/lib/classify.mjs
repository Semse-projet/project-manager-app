// Step 1 of the routing algorithm: deterministic, keyword-based task
// classification. No ML, no embeddings (kit's "No ML in Phase 1" rule) —
// this is intentionally a transparent, auditable rule set, not a model.

const FINANCIAL_RE = /\b(payment|payments|payout|payouts|escrow|invoice|billing|refund)\b/i;
const PRODUCTION_RE = /\b(production|prod\b|railway|live traffic)\b/i;
const AUTH_CROSS_TENANT_RE = /\b(auth\b|authoriz\w*|cross-tenant|cross tenant|idor|session revocation|permission\w*|rbac|access token)\b/i;
const AUDIT_BACKLOG_RE = /(audit_remediation_plan|audit-remediation|\brc[1-7]\b|jobstatus casing|\bg-(pro|adm|cli)-\d+|finding\s+\d|evidence upload|escrow[\s-]?integrity)/i;
const MIGRATION_INTEGRATION_RE = /\b(migration|migrate|integration|integrate|hardening|regression)\b/i;
const END_TO_END_RE = /(end-to-end|end to end|fully complete|finish\s+\w+\s+completely|across the api and|across multiple)/i;
const REPORT_RE = /(session report|end-of-session report|write (the |an )?(engineering |session )?report)/i;
const SPEC_RE = /\b(new feature|spec kit|write a spec|draft a spec|specify (the|a) feature)\b/i;
const VERIFICATION_RE = /\b(ci\b|pull request|\bpr\b\s*#?\d*|verify|verification|test(ing)?)\b/i;
const RELEASE_RE = /\b(release|deploy|ship it|rollout)\b/i;
const DISCOVERY_RE = /\b(investigate|discover|explore)\b/i;
const SIMPLE_SINGLE_FILE_RE = /\b(typo|one file|single color|single token|simple fix|quick fix)\b/i;
const DATA_MUTATION_RE = /\b(migration|schema|prisma)\b/i;
const READ_ONLY_RE = /\b(explain|what is|document|write (the |a )?report)\b/i;

export function classifyTask(taskText) {
  const t = taskText.toLowerCase();

  const isFinancial = FINANCIAL_RE.test(t);
  const isProduction = PRODUCTION_RE.test(t);
  const isAuthCrossTenant = AUTH_CROSS_TENANT_RE.test(t);
  const isAuditBacklog = AUDIT_BACKLOG_RE.test(t);
  const isMigrationIntegration = MIGRATION_INTEGRATION_RE.test(t);
  const isEndToEnd = END_TO_END_RE.test(t);

  let phase = "implementation";
  if (REPORT_RE.test(t)) phase = "report";
  else if (SPEC_RE.test(t)) phase = "spec";
  else if (RELEASE_RE.test(t)) phase = "release";
  else if (VERIFICATION_RE.test(t)) phase = "verification";
  else if (DISCOVERY_RE.test(t) && !isAuditBacklog) phase = "discovery";

  let mutation = "CODE_MUTATION";
  if (isFinancial) mutation = "FINANCIAL_MUTATION";
  else if (isProduction) mutation = "PRODUCTION_MUTATION";
  else if (DATA_MUTATION_RE.test(t)) mutation = "DATA_MUTATION";
  else if (READ_ONLY_RE.test(t)) mutation = "READ_ONLY";

  let risk = "LOW";
  if (isFinancial || (isAuthCrossTenant && isProduction)) risk = "CRITICAL";
  else if (isAuthCrossTenant || isProduction || isAuditBacklog) risk = "HIGH";
  else if (mutation === "DATA_MUTATION") risk = "MEDIUM";

  let scope = "SINGLE_LAYER";
  if (SIMPLE_SINGLE_FILE_RE.test(t)) scope = "SINGLE_FILE";
  else if (isEndToEnd) scope = "END_TO_END";
  else if (isMigrationIntegration) scope = "MULTI_LAYER";

  const needsSemseproject = isFinancial || isProduction || isAuthCrossTenant || risk === "CRITICAL" || risk === "HIGH";
  const needsAuditRemediation = isAuditBacklog;
  const needsAAA = scope === "END_TO_END" || scope === "MULTI_LAYER";

  let governanceReason = null;
  if (isFinancial) governanceReason = "financial mutation keywords detected";
  else if (isProduction) governanceReason = "production mutation keywords detected";
  else if (isAuthCrossTenant) governanceReason = "auth/cross-tenant/permission keywords detected";
  else if (needsSemseproject) governanceReason = "risk classified HIGH/CRITICAL";

  return {
    phase,
    mutation,
    risk,
    scope,
    needsSemseproject,
    needsAuditRemediation,
    needsAAA,
    governanceReason,
  };
}
