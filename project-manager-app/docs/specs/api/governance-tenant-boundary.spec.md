---
id: "api.governance-tenant-boundary"
title: "Governance Tenant and Actor Boundary"
domain: "governance"
version: "1.0"
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
  - Close through a conditional `{ id, tenantId, status: "open" }` update.
  - Require authenticated-only identity in every Governance BFF route.
  - Remove tenant/actor fields from BFF payloads before forwarding.
- Out of scope:
  - Replacing `ops:dashboard:read` with dedicated Governance permissions.
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
  POST /v1/governance/proposals/:id/close:
    lookup: id + caller_tenant
    write_condition: status == open
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
- A close succeeds only once through a conditional update.

## Security / RBAC

- Authentication: required.
- Current permission: `ops:dashboard:read`; a dedicated Governance permission is
  a separate authorization-hardening decision.
- Tenant boundary: deny by non-disclosure (`404`) for foreign IDs.
- BFF boundary: signed session identity only, with no static server fallback.

## Tests Required

- [x] Controller ignores forged `tenantId`, `authorId` and `voterId`.
- [x] Controller passes the authenticated tenant to every read/write.
- [x] Service proposal lookup includes `{ id, tenantId }`.
- [x] Foreign proposal vote and close perform zero writes.
- [x] Vote tenant comes from the scoped proposal.
- [x] Close update includes tenant and open status.
- [x] All Governance BFF routes use the authenticated-only helper.
- [x] BFF does not forward tenant or actor fields.

## Implementation Map

### API

- `apps/api/src/modules/governance/governance.controller.ts`
- `apps/api/src/modules/governance/governance.service.ts`

### Web

- `apps/web/app/api/semse/governance/**/route.ts`

### Tests

- `apps/api/test/governance.controller.test.ts`
- `apps/api/test/governance.service.test.ts`
- `tests/unit/governance-tenant-boundary.test.ts`

## Acceptance Criteria

- [x] API build passes.
- [x] Governance controller/service regressions pass.
- [x] Governance BFF inventory regression passes.
- [x] Strict spec validation and audit-plan coverage pass.
- [x] `docs/SPEC_INDEX.md` is regenerated.

## Rollback Considerations

- Reverting the service scoping reopens cross-tenant reads and writes.
- Do not roll back the BFF helper migration independently: doing so can also
  restore static server identity.
- No data migration is required. Historical mismatched votes should be audited
  separately rather than silently rewritten.
