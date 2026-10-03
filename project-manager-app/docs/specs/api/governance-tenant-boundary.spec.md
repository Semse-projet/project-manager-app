---
id: "api.governance-tenant-boundary"
title: "Governance Tenant and Actor Boundary"
domain: "governance"
version: "1.1"
status: "VERIFIED"
owner: "semse-core"
risk: "critical"
date: "2026-07-25"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "apps/api/src/modules/governance/governance.controller.ts"
  - "apps/api/src/modules/governance/governance.service.ts"
  - "apps/web/app/api/semse/governance"
  - "packages/auth/src/rbac.ts"
related_tests:
  - "apps/api/test/governance.controller.test.ts"
  - "apps/api/test/governance.service.test.ts"
  - "tests/unit/governance-tenant-boundary.test.ts"
related_endpoints:
  - "v1/governance"
related_events:
  - "governance:vote-cast"
  - "governance:proposal-closed"
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Governance Tenant and Actor Boundary

## Problem Statement

Governance proposals, votes, results, closure and credits are tenant data. A
caller must not choose the tenant through body or query parameters, and a
proposal ID from another tenant must behave as not found. Actor identity must
come from the authenticated request context.

The legacy implementation accepted `tenantId` from create/vote bodies and
list/credits queries, while detail, results and close looked up proposals only
by ID. A valid OPS_ADMIN in one tenant could therefore read or mutate another
tenant and could persist a vote whose `tenantId` disagreed with its proposal.

## Scope

- In scope:
  - Derive tenant and actor exclusively from `resolveRequestContext()`.
  - Scope proposal reads, results, votes and close by `{ id, tenantId }`.
  - Persist each vote with the tenant of the already-scoped proposal.
  - Filter included votes to the proposal tenant.
  - Filter proposal-list vote counts to the proposal tenant.
  - Serialize vote and close with the same proposal row lock.
  - Close through a conditional `{ id, tenantId, status: "open" }` update.
  - Use dedicated read/propose/vote/close permissions.
  - Require authenticated-only identity in every Governance BFF route.
  - Remove tenant/actor fields from BFF payloads before forwarding.
- Out of scope:
  - Changing voting weights, credit decay, quorum or proposal outcome rules.
  - Historical cleanup of inconsistent votes created before this boundary.

## API Contract

```yaml
identity_source:
  tenantId: authenticated_request_context
  authorId: authenticated_request_context.userId
  voterId: authenticated_request_context.userId
ignored_client_fields:
  - tenantId
  - authorId
  - voterId
endpoints:
  POST /v1/governance/proposals:
    tenant_scope: caller
  GET /v1/governance/proposals:
    tenant_scope: caller
    query:
      status: optional
  GET /v1/governance/proposals/:id:
    lookup: id + caller_tenant
  GET /v1/governance/proposals/:id/results:
    lookup: id + caller_tenant
  POST /v1/governance/proposals/:id/vote:
    lookup: id + caller_tenant
    invariant: vote.tenantId == proposal.tenantId
    concurrency: proposal_row_lock
  POST /v1/governance/proposals/:id/close:
    lookup: id + caller_tenant
    write_condition: status == open
    concurrency: proposal_row_lock_before_tally
  GET /v1/governance/credits/:userId:
    tenant_scope: caller
errors:
  cross_tenant_resource:
    status: 404
    message: Proposal not found
  stale_close:
    status: 409
```

## BFF Contract

```yaml
helper: fetchSemseDataForAuthenticatedRequest
forbidden:
  - fetchSemseData
  - fetchSemseDataForRequest
  - resolveRuntimeConfigForRequest
  - getServerConfig
forwarded_query_fields:
  proposals:
    - status
forbidden_forwarded_fields:
  - tenantId
  - authorId
  - voterId
```

## Data Invariants

- `GovernanceProposal.tenantId` equals the authenticated tenant that created it.
- `GovernanceVote.tenantId` equals its proposal tenant.
- Cross-tenant proposal IDs produce no vote or proposal-status write.
- Results and closure tally only votes scoped to the same tenant.
- Proposal-list vote counts include only votes scoped to the same tenant.
- A close succeeds only once through a conditional update.
- Vote and close cannot interleave a late vote after a stale tally.

## Security / RBAC

- Authentication: required.
- Read: `governance:read` (CLIENT, PRO, OPS_ADMIN).
- Propose: `governance:propose` (CLIENT, PRO, OPS_ADMIN).
- Vote: `governance:vote` (CLIENT, PRO, OPS_ADMIN).
- Close: `governance:close` (OPS_ADMIN only).
- Tenant boundary: deny by non-disclosure (`404`) for foreign IDs.
- BFF boundary: signed session identity only, with no static server fallback.

## Tests Required

- [x] Controller ignores forged `tenantId`, `authorId` and `voterId`.
- [x] Controller passes the authenticated tenant to every read/write.
- [x] Service proposal lookup includes `{ id, tenantId }`.
- [x] Foreign proposal vote and close perform zero writes.
- [x] Vote tenant comes from the scoped proposal.
- [x] Close update includes tenant and open status.
- [x] Proposal-list vote count includes `where: { tenantId }`.
- [x] Vote and close acquire the same proposal row lock inside transactions.
- [x] Duplicate vote constraint maps to 409.
- [x] CLIENT/PRO can read/propose/vote but cannot close; OPS_ADMIN can close.
- [x] All Governance BFF routes use the authenticated-only helper.
- [x] BFF inventory is discovered recursively and does not forward tenant or
  actor fields in the payload actually serialized.

## Implementation Map

### API

- `apps/api/src/modules/governance/governance.controller.ts`
- `apps/api/src/modules/governance/governance.service.ts`
- `packages/auth/src/rbac.ts`

### Web

- `apps/web/app/api/semse/governance/**/route.ts`

### Tests

- `apps/api/test/governance.controller.test.ts`
- `apps/api/test/governance.service.test.ts`
- `tests/unit/governance-tenant-boundary.test.ts`

## Acceptance Criteria

- [x] API build passes.
- [x] Governance controller/service regressions pass.
- [x] Auth package build and Governance role matrix pass.
- [x] Governance BFF inventory regression passes.
- [x] Strict spec validation and audit-plan coverage pass.
- [x] `docs/SPEC_INDEX.md` is regenerated.

## Rollback Considerations

- Reverting the service scoping reopens cross-tenant reads and writes.
- Do not roll back the BFF helper migration independently: doing so can also
  restore static server identity.
- No data migration is required. Historical mismatched votes should be audited
  separately rather than silently rewritten.
