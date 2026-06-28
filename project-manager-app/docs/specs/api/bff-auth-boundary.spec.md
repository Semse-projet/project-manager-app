---
id: "api-bff-auth-boundary"
title: "Web BFF Auth Boundary"
domain: "auth"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/web/middleware.ts"
  - "apps/web/lib/semse-api-auth.ts"
  - "apps/web/app/api/semse/_server.ts"
related_tests:
  - "tests/unit/web-bff-auth-policy.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-06-28"
---

# Spec: Web BFF Auth Boundary

## Problem Statement

The web BFF exposes many `/api/semse/*` proxy routes. Private routes must not be reachable anonymously, because older handlers can proxy through static server identity if they execute without a real user session.

## Scope

- In scope:
  - Classify `/api/semse/*` routes as private by default.
  - Keep only explicit public auth/intake/landing/health endpoints open.
  - Return JSON `401` for anonymous private BFF calls before route handlers execute.
  - Forward signed session identity headers to private BFF handlers when a session is valid.
- Out of scope:
  - Migrating every legacy `fetchSemseData()` route to `fetchSemseDataForRequest()`.
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
- Audit requirements: none at middleware level; backend keeps domain audit logs.

## i18n Requirements

- User-facing strings: none; API error body is stable English operational text.
- Required locales: none.

## Tests Required

- [x] Public allowlist includes auth token/login/register/reset/forgot, healthz, stats public and `/api/semse/public/*`.
- [x] Private examples include jobs, buildops, agro, ops metrics and SSE mission-control.
- [x] Unauthorized response body remains stable.

## Implementation Map

### API

- `apps/web/middleware.ts`
- `apps/web/lib/semse-api-auth.ts`
- `apps/web/app/api/semse/_server.ts`

### Web

- `apps/web/middleware.ts`

### Packages

- None.

### Tests

- `tests/unit/web-bff-auth-policy.test.ts`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`
- [x] Code files are listed in `related_files`
- [x] Tests are listed in `related_tests`
- [x] `docs/SPEC_INDEX.md` includes `api-bff-auth-boundary`
- [ ] Direct spec validation passes after pre-existing legacy spec drift is resolved

## Validation Notes

- `node scripts/spec-validate.mjs` currently fails on pre-existing legacy specs unrelated to this change:
  missing `tests/unit/payment-escrow-status-prisma.test.ts` references and `m3.1-multi-stage-releases.spec.md` metadata/status drift.
- `node scripts/spec-coverage.mjs --fail-on-gaps` currently fails on pre-existing tools specs without canonical metadata.
- `api-bff-auth-boundary` declares existing related files/tests and is not listed in those failures.

## Rollback Considerations

- How to disable: revert middleware auth boundary change.
- Data rollback: none.
- Operational owner: semse-core.
