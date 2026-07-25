---
id: "api-bff-auth-boundary"
title: "Web BFF Auth Boundary"
domain: "auth"
version: "1.1"
status: "VERIFIED"
owner: "semse-core"
risk: "critical"
related_files:
  - "apps/web/middleware.ts"
  - "apps/web/lib/semse-api-auth.ts"
  - "apps/web/app/api/semse/_server.ts"
  - "apps/web/app/api/semse/buildops"
  - "apps/web/app/api/semse/field-ops"
  - "apps/web/app/api/semse/governance"
  - "apps/web/app/api/semse/incidents/route.ts"
  - "apps/web/app/api/semse/materials/route.ts"
  - "apps/web/app/api/semse/ops"
  - "apps/web/app/api/semse/tasks"
related_tests:
  - "tests/unit/web-bff-auth-policy.test.ts"
  - "tests/unit/sensitive-bff-boundary.test.ts"
related_endpoints:
  - "POST v1/buildops/estimates/from-tool-result"
  - "POST v1/buildops/plans/:projectId/approve"
  - "POST v1/buildops/plans/:projectId/reject"
  - "POST v1/buildops/plans/:projectId/request-changes"
  - "POST v1/buildops/plans/:projectId/unapprove"
  - "POST v1/buildops/projects"
  - "POST v1/buildops/tasks"
  - "PUT v1/field-ops/units/:unitId/status"
  - "POST v1/field-ops/units"
  - "PUT v1/field-ops/vendors/:vendorId/compliance"
  - "POST v1/field-ops/vendors"
  - "POST v1/field-ops/worklogs"
  - "POST v1/governance/proposals/:id/close"
  - "POST v1/incidents"
  - "POST v1/materials"
  - "POST v1/ops/agent-runtime/:id/requeue"
  - "POST v1/ops/agent-runtime/:id/retry"
  - "POST v1/ops/alerts/:alertId/ack"
  - "POST v1/ops/incidents"
  - "POST v1/ops/runbooks/:runbookId/execute"
  - "PATCH v1/tasks/:taskId/status"
  - "POST v1/tasks"
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Web BFF Auth Boundary

## Problem Statement

The web BFF exposes many `/api/semse/*` proxy routes. Private routes must not be reachable anonymously, and a valid low-privilege session must never be replaced by the server's static `SEMSE_*` identity. The legacy bare `fetchSemseData()` helper ignores the signed session entirely; with the default static role it can turn a CLIENT/PRO/WORKER mutation into an OPS_ADMIN backend call.

## Scope

- In scope:
  - Classify `/api/semse/*` routes as private by default.
  - Keep only explicit public auth/intake/landing/health endpoints open.
  - Return JSON `401` for anonymous private BFF calls before route handlers execute.
  - Forward signed session identity headers to private BFF handlers when a session is valid.
  - Require `fetchSemseDataForAuthenticatedRequest()` in the reviewed inventory of 22 mutation-capable routes that previously used bare `fetchSemseData()`.
  - Fail closed when a sensitive route is reached without signed session headers or a valid signed session cookie; never fall back to `SEMSE_TENANT_ID`, `SEMSE_USER_ID` or `SEMSE_ROLES`.
- Out of scope:
  - Migrating the remaining request-aware handlers whose `fetchSemseDataForRequest()` path still has a static fallback. Under the normal middleware path they receive signed session headers, but removing that defense-in-depth debt is a separate phase.
  - Converting read-only routes that still use bare `fetchSemseData()`; they require a separate authorization and tenant-scope review.
  - Changing backend `AuthGuard` or `RbacGuard`.
  - Reworking mobile token auth.

## API Contract

### `ANY /api/semse/*`

```yaml
auth: required-by-default
public_allowlist:
  exact:
    - /api/semse/auth/forgot-password
    - /api/semse/auth/login
    - /api/semse/auth/register
    - /api/semse/auth/reset-password
    - /api/semse/auth/token
    - /api/semse/healthz
    - /api/semse/stats/public
    - /api/semse/product-intelligence/ingest
  prefixes:
    - /api/semse/public/
errors:
  401:
    body:
      error:
        status: 401
        message: Authentication required for SEMSE API route
effects:
  request_headers:
    - x-semse-user-id
    - x-semse-tenant-id
    - x-semse-org-id
    - x-semse-roles
  sensitive_proxy_helper: fetchSemseDataForAuthenticatedRequest
  forbidden_sensitive_proxy_helpers:
    - fetchSemseData
    - fetchSemseDataForRequest
```

## UI Contract

```yaml
screens: []
states:
  - unauthenticated-api-call
required_behavior:
  - Authenticated pages call private BFF routes with the signed session cookie.
  - Public landing and intake only call allowlisted public BFF routes.
```

## Agent Contract

```yaml
agent: security-review
input_schema:
  route: string
output_schema:
  public: boolean
  rationale: string
privacy_routing:
  private_by_default: true
forbidden_behavior:
  - Marking a route public because it is used by a page without proving the page is public.
  - Adding wildcard public prefixes outside /api/semse/public/.
```

## SSE / Event Contract

```yaml
event: none
channel: none
payload: none
consumers: []
expected_reaction: []
```

## Data Model Impact

- Prisma models: none.
- Migrations: none.
- Backfill: none.

## Security / RBAC

- Required permissions: backend remains source of permission truth after BFF session gate.
- Tenant boundary: middleware forwards signed session tenant/org/user identity to BFF route handlers.
- Privilege boundary: mutation-capable routes in the P0 inventory call the backend as the signed user. They cannot use or fall back to the server's static role.
- Enforcement split: middleware authenticates the session; backend guards authorize the forwarded role. The inventoried BFF handlers do not invent a local role or replace it with `OPS_ADMIN`.
- Audit requirements: none at middleware level; backend keeps domain audit logs.

## i18n Requirements

- User-facing strings: none; API error body is stable English operational text.
- Required locales: none.

## Tests Required

- [x] Public allowlist includes auth token/login/register/reset/forgot, healthz, stats public and `/api/semse/public/*`.
- [x] Public allowlist includes the signed product-intelligence ingest endpoint used by the landing funnel.
- [x] Private examples include jobs, buildops, agro, ops metrics and SSE mission-control.
- [x] Unauthorized response body remains stable.
- [x] The explicit 22-route P0 mutation inventory uses `fetchSemseDataForAuthenticatedRequest()`.
- [x] No mutation-capable SEMSE BFF route directly calls bare `fetchSemseData()`.
- [x] The authenticated-only helper has no static runtime fallback.

## Implementation Map

### API

- `apps/web/middleware.ts`
- `apps/web/lib/semse-api-auth.ts`
- `apps/web/app/api/semse/_server.ts`
- `apps/web/app/api/semse/buildops/**/route.ts` (7 migrated mutation routes)
- `apps/web/app/api/semse/field-ops/**/route.ts` (5 migrated mutation routes)
- `apps/web/app/api/semse/governance/proposals/[id]/close/route.ts`
- `apps/web/app/api/semse/incidents/route.ts`
- `apps/web/app/api/semse/materials/route.ts`
- `apps/web/app/api/semse/ops/**/route.ts` (5 migrated mutation routes)
- `apps/web/app/api/semse/tasks/**/route.ts` (2 migrated mutation routes)

### Web

- `apps/web/middleware.ts`

### Packages

- None.

### Tests

- `tests/unit/web-bff-auth-policy.test.ts`
- `tests/unit/sensitive-bff-boundary.test.ts`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`
- [x] Code files are listed in `related_files`
- [x] Tests are listed in `related_tests`
- [x] `docs/SPEC_INDEX.md` includes `api-bff-auth-boundary`
- [x] The 22 reviewed mutation routes preserve signed session identity and cannot elevate through static `SEMSE_*` configuration
- [x] Direct strict spec validation passes

## Validation Notes

- 2026-07-25: migrated the complete P0 inventory of 22 mutation-capable routes that used bare `fetchSemseData()`.
- The regression intentionally does not fail on request-aware legacy handlers in the separate phase-2 inventory; it does fail if any mutating route introduces a new direct call to the static-identity helper.
- The phase-2 audit found 213 mutation handlers still capable of reaching a static fallback through request-aware or local config helpers (one is the intentionally public login route). They remain explicit debt and are not declared remediated here.
- `node scripts/spec-validate.mjs --strict` passes for the workspace after this alignment.

## Rollback Considerations

- How to disable: revert the sensitive-route helper migrations and their inventory regression together. Do not restore bare static identity on only a subset.
- Data rollback: none.
- Operational owner: semse-core.
