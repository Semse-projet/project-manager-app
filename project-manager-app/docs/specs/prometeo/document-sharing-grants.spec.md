# Prometeo Document Sharing Grants — P0/C51 S1

Status: DRAFT — requires CI, authenticated integration, security review; must not deploy standalone.
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

- `POST /v1/prometeo/documents/:id/shares` with `{ recipientOrgId }`: requires knowledge:write and verified owner, returns only grant metadata. Idempotent regrant, audited.
- `DELETE /v1/prometeo/documents/:id/shares/:recipientOrgId`: owner/OPS_ADMIN only, audited; revoke active grant; repeat revoke must not assert success.
- Project membership for the recipient is validated server-side. Client-supplied `projectId` and `visibility` are not grant authorities.
- Existing list/search/rag-query/trade-guide use same SQL grant predicate. No separate unscoped retrieval.

## Verification gates

1. Unit tests for tenant/org spoofing, invalid project, legacy forged association, regrant/revoke, audit write failure.
2. Real PostgreSQL 16 integration for pre-grant deny → grant allow → revoke deny, foreign tenant deny, membership exclusion, SQL pagination, audit rows.
3. Signed-session HTTP smoke in isolated CI with client/pro from a real project; verify no leak in snippets, citations, feedback and deletion.
4. Separate staging smoke against reviewed disposable dataset; independent security review and rollback plan before production.
5. The existing P0 #974 remains OPEN until all production release gates pass.

No production schema migration or deployment is authorized by this document.
