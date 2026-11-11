---
id: "prometeo.document-sharing-grants"
title: "Compartición explícita y revocable de documentos Prometeo"
sdd_version: "2.0"
domain: "prometeo"
version: "1.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "INACTIVE"
migration_status: "APPLIED"
feature_flags:
  - SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED
production_evidence:
  - github:pr:987:head:4c2d9415896e5b4fb3636ad57c5b10df29eb056d:checks-passed
  - github:actions:41356995428:quality-gates-unit-coverage-e2e-success
  - github:pr:987:merge:4f06fb2422f0b39822177bb1730e95cc85ee25ab
  - railway:api:deployment:ee92284f-6f07-46ad-a25c-cf09343fb1b4:success
  - railway:web:deployment:46cce7b1-075d-4b90-8360-a012b76b6e78:success
  - railway:worker:deployment:02838719-edbc-44cf-8cef-cf914a8e1bd0:success
  - railway:vision:deployment:70b6743a-6f96-4595-9432-051f23f91fda:success
  - railway:postgres:migration:20261017213000_prometeo_document_grants:applied
  - railway:api:flag:SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED:absent-off
  - railway:staging:off-revoke-audited:8d8b22fa-42e3-4277-b849-26c76434ccb9:success
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
last_verified: "2026-11-01"
---

# Prometeo Document Sharing Grants — P0/C51 S1

Status: REVIEW — formal documentary approval of this exact SDD version is pending under DEC-PLATFORM-001 level 1; level-3 human security review and activation authorization are separate pending gates. Code was merged and deployed with sharing OFF; delivery evidence is recorded below.
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

Design pending formal documentary approval under DEC-PLATFORM-001 level 1 (this spec stays in `REVIEW`; level-3 independent human review is separately mandatory before activation):
- A document grant must reference the exact `(documentId, tenantId, projectId)` of its parent document. Add a unique composite parent key and a composite foreign key from the grant. Deleting the parent remains CASCADE **only through the audited document deletion transaction**; updating tenant/project association with an existing grant is restricted, not automatically cascaded to a new project.
- Use a single `grants.some({ tenantId, recipientOrgId, projectId: { in: accessibleProjectIds }, revokedAt: null })` branch, instead of one nested `OR` per accessible project. The composite FK guarantees the grant and document refer to the same project/tenant.
- Legacy `projectId` is not a sharing grant; historical visibility flags do not override authorization.
- Migration applies only to a fresh isolated database in CI/staging pending approval. Do not edit any already-deployed production schema or automatically backfill old data.
- Tests: Prisma filters with many project IDs keep constant OR cardinality; PostgreSQL refuses cross-project and cross-tenant grant insertion and rejects silent reassociation while a grant exists; authorized grant/revoke and audit-delete flows still pass.
- This design must be signed off with the spec and release plan before merging into production.

## DEC-PLATFORM-001 clarification (2026-11-02, documentary only)

[DEC-PLATFORM-001](../../architecture/DEC-PLATFORM-001-solo-maintainer-review.md) is ACCEPTED and governs the sole-maintainer case. Documentary `REVIEW → APPROVED` may be decided at level 1 with final-SHA CI, linked automated review and the owner's formal comment; it is not blocked by a missing second maintainer. Separate level-2 controls apply to new sensitive-code changes while flags remain OFF. Level-3 activation/exposure to another organization **still requires a real external human reviewer**, allowlist canary, proven rollback and operational approval. Historical contributor documents remain private until their independent contributor/rightsholder consent and curated-knowledge gates are satisfied. This clarification is **not** an approval receipt and changes no production configuration.

## SDD governance and scope traceability (2026-10-18)

This document remains **REVIEW**, even though PR #987 was merged and deployed with sharing OFF under an explicitly recorded exception. Formal acceptance of this exact SDD and its composite-key amendment requires DEC-PLATFORM-001 **level 1**: green CI on the final documentary PR SHA, linked automated review without blocking findings, and an authenticated owner approval comment stating SHA, date and scope. The sole maintainer does not need a second human reviewer for this documentary decision. This does **not** retrospectively satisfy missing gates of #987, approve ADR-046, authorize another code release, or permit level-3 sharing activation.

- Plan: [document-sharing-grants.plan.md](document-sharing-grants.plan.md); tasks: [document-sharing-grants.tasks.md](document-sharing-grants.tasks.md); checklist: [document-sharing-grants.checklist.md](document-sharing-grants.checklist.md).
- Architecture decision proposed (not accepted): [ADR-046](../../architecture/ADR-046-prometeo-document-grants-private-model-routing.md), including add-on read grants to ResourceScope, mandatory local-only private inference, and no-cloud embeddings/FTS degradation.
- S0 document/tenant/org scope and legacy labels, S1 project grant/revoke/audit, S2 agent/project thread ownership and local-only RAG are **separable logical slices** despite the consolidated integration branch. No production activation should infer that all are approved together.
- Canonical audit catalog: `prometeo.document_share_granted`, `prometeo.document_share_revoked`, `prometeo.document_share_revoked_by_delete`, `prometeo.document_deleted`. AuditLog action naming is verified at code-level; staging traces are outstanding.
- `projectId` and `tenantId` of documents that have linked grants cannot be reassigned silently. The `ON UPDATE RESTRICT` composite FK and `UNIQUE(id,tenantId,projectId)` parent key enforce the boundary at PostgreSQL level. Approved reassociation workflow is **not implemented** and must be a separate guarded command, not ad-hoc Prisma updates.
- The existing `public_training` metadata is historical descriptive data, **not consent**. Project-less documents owned by OPS remain private; cross-organization contributor knowledge promotion is tracked in #992, with no automatic backfill, publication or grant.
- Operational invariants and dependent contracts: `platform.resource-scope` (actor/org/project/job scope), `prometeo.model-gateway-unification` (privacy hard constraints), `api-prometeo-rag-trade-knowledge` (private embeddings/FTS), `api-prometeo-copilot` (thread and tool fallback) and `prometeo.chat-evidence` (authorized evidence/RAG).

## Independent security review amendment — Ollama local boundary

The `localOnly`/ `privacyCritical` flags are **hard endpoint constraints**, not merely provider-name selection. `OllamaProvider.isLocalEndpoint()` must validate a parsed, exact loopback hostname; VPS, Docker-network service names, lookalike DNS names, and public URLs are not permitted for private prompts. `LLMOrchestrator` filters out untrusted Ollama even with static fallback routing, and the provider independently refuses a private call on an untrusted URL. Private POST redirects are disabled. When no local inference is available, fail closed to the local template/rules fallback, never to another external provider.

These source changes do not authorize activation; staging outbound-traffic tests and a **real independent human security review at level 3** remain mandatory before external exposure. The SDD stays `REVIEW`.

## Registro factual posterior al merge #987 — 2026-11-01

Este registro reconcilia **hechos de entrega**, no la autorización de compartir documentos. El propietario solicitó fusionar el PR #987 por excepción documentada antes de cumplir la pausa de 24 horas, la autorrevisión posterior y la aprobación formal del contrato; dichos gates **no** se marcan retroactivamente como cumplidos.

- HEAD revisado: `4c2d9415896e5b4fb3636ad57c5b10df29eb056d`; squash merge a `main`: `4f06fb2422f0b39822177bb1730e95cc85ee25ab`.
- CI sobre el HEAD revisado: 7/7 workflows SUCCESS, incluidos `quality-gates`, `unit-coverage` y `e2e` (run `41356995428`). Codex y Copilot informaron que no encontraron hallazgos bloqueantes; no constituyen revisión humana independiente.
- Railway producción: API `ee92284f`, web `46cce7b1`, worker `02838719` y vision `70b6743a` terminaron SUCCESS; se aplicó la migración aditiva `20261017213000_prometeo_document_grants`.
- `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED` no estaba configurada en la API de producción al verificarse; la implementación sólo activa compartir con el literal `true`. `activation_status: INACTIVE` permanece vigente.
- Staging sintético: se comprobó aislamiento cross-org/cross-tenant y revocación del propietario mientras compartir estaba OFF, con auditoría. No se ha ejecutado el inventario agregado de documentos históricos sobre PostgreSQL de producción.

**Gates aún pendientes:** SDD `status: REVIEW`, ADR-046 `Proposed`, decisión documentada del propietario sobre seguridad y consentimientos, inventario histórico, revisión humana externa y canario/rollback antes de activar sharing (nivel 3). #974 permanece abierto. Los estados `COMPLETE/PASS/MERGED/DEPLOYED/APPLIED` describen entrega de código, no aprobación del acceso entre organizaciones.

Evidencias: [excepción del propietario](https://github.com/Semse-projet/project-manager-app/pull/987#issuecomment-6565038261), [despliegue y migración](https://github.com/Semse-projet/project-manager-app/pull/987#issuecomment-6565123258), [revocación con flag OFF](https://github.com/Semse-projet/project-manager-app/pull/987#issuecomment-6565167452).
