# ADR-046 — Prometeo explicit document grants and private-model boundary

- **Date:** 2026-10-18
- **Status:** Proposed — **NOT ACCEPTED**. Requires owner/security architecture review; PR #987 was merged and deployed under a documented exception, but sharing remains OFF.
- **Owners:** semse-core; decision authority pending named approval
- **Context:** Security issue #974, merged PR #987, SDD `prometeo.document-sharing-grants` (REVIEW), issue #992.
- **Relations:** ADR-040 (organization and membership), ADR-036 (Prometeo orchestrator), ADR-038 (copilot), `platform.resource-scope`, `prometeo.model-gateway-unification`.

## Problem

Membership and `rbac.ts` are necessary but do not alone authorize access to a particular document. A tenant can contain multiple organizations, and legacy `public_training` flags or a bare `projectId` have no verified consent. A new cross-org capability must not bypass actor authentication, resource scope, auditing or private model routing.

SDD governance ordinarily prohibits merging under a REVIEW spec. PR #987 was merged under an explicitly documented owner-directed exception, which **does not accept this ADR, satisfy uncompleted gates, or authorize activation**.

## Decision proposed (subject to sign-off)

1. **Additive, resource-bound read grant.** An active `PrometeoDocumentGrant` grants *read* only to a participating organization of the same live project and tenant when combined with its user's valid role/membership and the documented ResourceScope filter. It **does not grant a role**, modify tenant session, confer delete rights or authorize arbitrary project access.
2. **Trust chain:** signed actor → role/permission → active membership + project/job scope → document owner or explicit non-revoked recipient grant → SQL filter → chunks/RAG/citations. No tenant-wide implied sharing. OPS_ADMIN remains limited to its tenant.
3. **DB invariants:** a composite FK `(documentId,tenantId,projectId)` to the parent triple, unique parent key and `ON UPDATE RESTRICT` prevent stale project/tenant reassociation granting new reads. Association edits require a separate governed command. Grant/revoke/delete audit operations must be atomic (Serializable with bounded safe retries).
4. **Private-model boundary:** `localOnly` and `privacyCritical` are hard fail-closed constraints; `preferredProvider` never overrides them. Local Ollama's prompt-adapted tool adapter may count as tool-capable only under verified local execution. Project Copilot's private threads and evidence-review RAG cannot route private payloads to cloud models.
5. **Embeddings:** private Prometeo ingestion/query/backfill do not call cloud embeddings by default. If no verified local embedding provider exists, keyword/FTS degrades functionality rather than exfiltrating data. Cloud embedding for genuinely public/consented corpus requires a **separate, explicitly approved** data-flow contract; old vectors are not certified or deleted by this change.
6. **Historical data:** `public_training` is not sufficient consent. Ops-owned contributor knowledge (#992) stays private absent a governed opt-in, redaction/provenance, revoke and audit design.

## Alternatives evaluated

- Share every document within a tenant / trust old visibility labels: **rejected**, cross-org leak.
- Trust `projectId` or `Org` membership alone: **rejected**, project participation does not imply permission to publish documents.
- Copy content into recipient org and treat as owner: **rejected** in S1, complicated revocation and provenance.
- Allow cloud fallback on local-model outage: **rejected**, confidentiality outweighs availability.
- Automatically drop FK/table on rollback: **rejected**, destructive and loses audit trail; prefer app rollback while preserving expanded schema, then reviewed forward-fix.

## Compatibility and rollout requirements

- This grant is **additional**, not a substitute for `Membership` → RBAC or `ResourceScope` (clarifies ADR-040's single capability path: RBAC remains the only way to attain a role, while resource grants narrow the visibility of individual documents).
- SQL migration introduces `UNIQUE(id,tenantId,projectId)` on `PrometeoDocument` and `ON UPDATE RESTRICT` for linked grants. Old app versions may continue reading/writing unrelated documents; they **must not** silently change associations with active grants. Verify old-version interactions on isolated DB before rollout.
- Feature activation is prohibited until spec APPROVED, ADR accepted, exact SHA CI PASS, full signed-session staging acceptance, legacy inventory/consent decision, independent review and rehearsed app rollback.
- Rollback retains DB constraints/grants/audit; downgrade image/application only with compatibility proof. No destructive down-migration is authorized by this ADR.
- Ledger of independent review must explicitly name document/grant/agent model privacy threats and all accepted trade-offs.

## Consequences and verification

- Positives: explicit auditable cross-org read and immediate revoke; no automatic cross-tenant/cross-project grant, bounded SQL query, fail-closed egress.
- Trade-offs: when local model/embeddings unavailable, no cloud semantic fallback; project reassociation blocked by FK until separately governed; historical promoted content may not be visible.
- Verification: PostgreSQL FK negative tests, 20k project predicate bound, idempotent regrant concurrent tests, deletion/audit rollback, actor/org cross-tenant signed sessions, no-cloud network capture, Ollama local tools integration, and isolated staging rollback.
- **Status remains Proposed** until reviewed and approved independently; do not mistake an automated Codex approval for governance sign-off.

## Nota posterior al merge #987 — 2026-11-01

El código de PR #987 fue fusionado a `main` (squash `4f06fb2422f0b39822177bb1730e95cc85ee25ab`) y desplegado con el flag `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED` desactivado por defecto. La migración aditiva `20261017213000_prometeo_document_grants` se aplicó en producción.

Este es un **registro de hechos de entrega**, no la aceptación de ADR-046. El merge anticipado por petición del propietario y su excepción de gobernanza se documentaron en [PR #987](https://github.com/Semse-projet/project-manager-app/pull/987#issuecomment-6565038261). Permanecen pendientes la aprobación del contrato de seguridad, el inventario histórico y consentimientos, la revisión externa de nivel 3, el canario allowlist y un rollback autorizado antes de cualquier compartición real entre organizaciones.

El estado **Proposed / NOT ACCEPTED** no cambia y no debe inferirse aprobación de CI, migración o Railway SUCCESS.
