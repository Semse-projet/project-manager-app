---
id: "prometeo.document-sharing-grants"
title: "Compartición explícita y revocable de documentos Prometeo"
sdd_version: "2.0"
domain: "prometeo"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED
production_evidence: []
# Explicit SEMSE cross-domain declarations: REVIEW only, not approval.
privacyCritical: true
auditLog: true
sse: false
fsmTransicion: "document grant active/revoked (no escrow or job FSM change)"
paymentGovernance: "N/A — no payment authorization or escrow release from document sharing"
related_files:
  - apps/api/src/modules/prometeo/prometeo-document-grant.service.ts
  - apps/api/src/modules/prometeo/prometeo.controller.ts
  - apps/api/src/modules/prometeo/prometeo.repository.ts
  - apps/api/src/modules/prometeo/prometeo.module.ts
  - apps/api/src/modules/prometeo/prometeo.service.ts
  - apps/api/src/modules/prometeo/prometeo-access.policy.ts
  - apps/api/src/modules/prometeo/trade-guide.service.ts
  - apps/api/src/common/resource-scope.resolver.ts
  - apps/api/src/modules/agents/agents.service.ts
  - apps/api/src/modules/agents/project-access.service.ts
  - apps/api/src/modules/milestones/milestones.controller.ts
  - apps/api/src/modules/agents/harnesses/project-copilot.harness.ts
  - apps/api/src/modules/operational-intelligence/evidence-review.service.ts
  - apps/api/src/modules/operational-intelligence/buildops-intelligence.agent.ts
  - apps/api/src/modules/contributor-program/contributor-program.service.ts
  - apps/api/src/common/chat-thread.store.ts
  - apps/api/src/common/domain-store.ts
  - apps/api/src/infrastructure/llm/adapters/tools.adapter.ts
  - packages/auth/src/rbac.ts
  - apps/api/src/infrastructure/llm/router/adaptive-router.ts
  - apps/api/src/infrastructure/llm/orchestrator.ts
  - apps/api/src/infrastructure/llm/providers/ollama.provider.ts
  - apps/api/src/modules/prometeo/embedding.service.ts
  - apps/web/app/(app)/admin/prometeo/page.tsx
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20261017213000_prometeo_document_grants/migration.sql
  - scripts/api-authenticated-f01-f02-smoke.mjs
related_tests:
  - apps/api/test/prometeo-documents-scope-integration.test.ts
  - apps/api/test/prometeo-document-grant-integration.test.ts
  - apps/api/test/prometeo-document-scope.test.ts
  - apps/api/test/prometeo-live-project-scope.test.ts
  - apps/api/test/prometeo-private-embeddings.test.ts
  - apps/api/test/agents-thread-owner-scope.test.ts
  - apps/api/test/agents-private-copilot-routing.test.ts
  - apps/api/test/evidence-review-rag-scope.test.ts
  - apps/api/test/adaptive-router.test.ts
  - apps/api/test/private-local-tool-router.test.ts
  - apps/api/test/llm-private-ollama-boundary.test.ts
  - apps/api/test/tools-adapter.test.ts
  - apps/api/test/buildops-intelligence-milestone-tenant-scope.test.ts
  - scripts/api-authenticated-f01-f02-smoke.mjs
related_endpoints:
  - "DELETE /v1/prometeo/documents/:id"
  - "POST /v1/prometeo/documents/:id/shares"
  - "DELETE /v1/prometeo/documents/:id/shares/:recipientOrgId"
related_events:
  - prometeo.document_share_granted
  - prometeo.document_share_revoked
  - prometeo.document_share_revoked_by_delete
  - prometeo.document_deleted
related_agents: ["prometeo"]
last_verified: "2026-10-18"
---

# Prometeo Document Sharing Grants — P0/C51 S1

Status: REVIEW — requires owner/security approval of contract, current-HEAD CI, authenticated staging and independent sign-off; must not deploy standalone.
Depends on: PR #977 (S0 owner-only server-side RAG/document scope). Tracks issue #974.

## Invariants

- Default DENY. `projectId`, `metadataJson.visibility`, `public_training` and `tenantId` alone never grant cross-org access.
- A share grant is **one document → one authorized participant organization** within the exact same tenant and verified project.
- Only the **owning organization** (or OPS_ADMIN of the tenant) may grant/revoke. Validate the owning org belongs to the project, even for legacy documents.
- Sharing a project document is allowed only with a client organization or the assigned professional organization of an existing project, excluding the owner itself.
- Scope lookup must be performed **before SQL pagination and before RAG text/citations/LLM**. Both current project membership and an active grant (`revokedAt = null`) are required for every read.
- Revocation blocks future queries immediately; previous output/history is not retroactively erased. No content copied across tenants.
- Grant and revoke are atomic with an `AuditLog` entry, fail closed on write/audit failures.
- No sharing on documents without project; no tenant-wide or public grants, automatic publication, blanket `public_training` migration or implicit access from historical labels.
- Changes to grant membership or project assignment revoke effective read access automatically via the read-time project-scope predicate. OPS_ADMIN is still limited to its tenant.
- Participant can **read** shared document and RAG context only; cannot delete source, manage shares, or submit chunk corrections to another organization.
- Contradictions between tenant/document/project/owner/recipient cause 400/403/404 as appropriate. A cross-tenant document is 404.

## API

- `POST /v1/prometeo/documents/:id/shares` with `{ recipientOrgId }`: requires `knowledge:share` and verified owner, returns only grant metadata. Idempotent regrant, audited.
- `DELETE /v1/prometeo/documents/:id/shares/:recipientOrgId`: owner/OPS_ADMIN only, audited; revoke active grant; repeat revoke must not assert success.
- Project membership for the recipient is validated server-side. Client-supplied `projectId` and `visibility` are not grant authorities.
- Existing list/search/rag-query/trade-guide use same SQL grant predicate. No separate unscoped retrieval.
- `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED` is **OFF by default** and enabled only by the literal value `true`. With sharing disabled, POST grants fail closed and grant-based document retrieval remains hidden; owner-authorized DELETE revoke remains available for incident cleanup. Flag activation remains prohibited while this SDD is REVIEW.
- **Excepción estricta de CI no productiva:** el workflow `api-integration.yml` establece temporalmente `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED=true` exclusivamente para pruebas automatizadas con cuentas sintéticas y PostgreSQL efímero. Esto prueba grant/revoke sin activar la funcionalidad en Railway, staging compartido o producción; no constituye aprobación del SDD ni excepción al bloqueo de despliegue. La variable debe permanecer ausente/deshabilitada en entornos reales mientras el contrato esté `REVIEW`.

## Verification gates

1. Unit tests for tenant/org spoofing, invalid project, legacy forged association, regrant/revoke, audit write failure.
2. Real PostgreSQL 16 integration for pre-grant deny → grant allow → revoke deny, foreign tenant deny, membership exclusion, SQL pagination, audit rows.
3. Signed-session HTTP smoke in isolated CI with client/pro from a real project; verify no leak in snippets, citations, feedback and deletion.
4. Separate staging smoke against reviewed disposable dataset; independent security review and rollback plan before production.
5. The existing P0 #974 remains OPEN until all production release gates pass.

No production schema migration or deployment is authorized by this document.

## Amendment — bounded authorization SQL for large project memberships (Codex P2)

Design pending independent approval (this spec stays in `REVIEW`):
- A document grant must reference the exact `(documentId, tenantId, projectId)` of its parent document. Add a unique composite parent key and a composite foreign key from the grant. Deleting the parent remains CASCADE **only through the audited document deletion transaction**; updating tenant/project association with an existing grant is restricted, not automatically cascaded to a new project.
- Use a single `grants.some({ tenantId, recipientOrgId, projectId: { in: accessibleProjectIds }, revokedAt: null })` branch, instead of one nested `OR` per accessible project. The composite FK guarantees the grant and document refer to the same project/tenant.
- Legacy `projectId` is not a sharing grant; historical visibility flags do not override authorization.
- Migration applies only to a fresh isolated database in CI/staging pending approval. Do not edit any already-deployed production schema or automatically backfill old data.
- Tests: Prisma filters with many project IDs keep constant OR cardinality; PostgreSQL refuses cross-project and cross-tenant grant insertion and rejects silent reassociation while a grant exists; authorized grant/revoke and audit-delete flows still pass.
- This design must be signed off with the spec and release plan before merging into production.

## SDD governance and scope traceability (2026-10-18)

This document is **REVIEW**, not authorization to merge or activate the implementation. The code on draft PR #987 is provisional and ahead of approval. Human owner/security sign-off must explicitly cover this design and the composite-key amendment before status may change. The author of this update cannot self-approve it.

- Plan: [document-sharing-grants.plan.md](document-sharing-grants.plan.md); tasks: [document-sharing-grants.tasks.md](document-sharing-grants.tasks.md); checklist: [document-sharing-grants.checklist.md](document-sharing-grants.checklist.md).
- Architecture decision proposed (not accepted): [ADR-046](../../architecture/ADR-046-prometeo-document-grants-private-model-routing.md), including add-on read grants to ResourceScope, mandatory local-only private inference, and no-cloud embeddings/FTS degradation.
- S0 document/tenant/org scope and legacy labels, S1 project grant/revoke/audit, S2 agent/project thread ownership and local-only RAG are **separable logical slices** despite the consolidated integration branch. No production activation should infer that all are approved together.
- Canonical audit catalog: `prometeo.document_share_granted`, `prometeo.document_share_revoked`, `prometeo.document_share_revoked_by_delete`, `prometeo.document_deleted`. AuditLog action naming is verified at code-level; staging traces are outstanding.
- `projectId` and `tenantId` of documents that have linked grants cannot be reassigned silently. The `ON UPDATE RESTRICT` composite FK and `UNIQUE(id,tenantId,projectId)` parent key enforce the boundary at PostgreSQL level. Approved reassociation workflow is **not implemented** and must be a separate guarded command, not ad-hoc Prisma updates.
- The existing `public_training` metadata is historical descriptive data, **not consent**. Project-less documents owned by OPS remain private; cross-organization contributor knowledge promotion is tracked in #992, with no automatic backfill, publication or grant.
- Operational invariants and dependent contracts: `platform.resource-scope` (actor/org/project/job scope), `prometeo.model-gateway-unification` (privacy hard constraints), `api-prometeo-rag-trade-knowledge` (private embeddings/FTS), `api-prometeo-copilot` (thread and tool fallback) and `prometeo.chat-evidence` (authorized evidence/RAG).

## Independent security review amendment — Ollama local boundary

The `localOnly`/ `privacyCritical` flags are **hard endpoint constraints**, not merely provider-name selection. `OllamaProvider.isLocalEndpoint()` must validate a parsed, exact loopback hostname; VPS, Docker-network service names, lookalike DNS names, and public URLs are not permitted for private prompts. `LLMOrchestrator` filters out untrusted Ollama even with static fallback routing, and the provider independently refuses a private call on an untrusted URL. Private POST redirects are disabled. When no local inference is available, fail closed to the local template/rules fallback, never to another external provider.

These source changes do not authorize activation; staging outbound-traffic tests and independent review sign-off remain required. The SDD stays `REVIEW`.
