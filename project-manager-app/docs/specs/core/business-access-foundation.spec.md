---
id: "core.business-access-foundation"
title: "Acceso vigente a organizaciones y revocación de sesiones"
domain: "core"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/auth/auth.service.ts"
  - "apps/api/src/modules/auth/auth.repository.ts"
  - "apps/api/src/modules/organizations/organizations.service.ts"
  - "apps/api/src/modules/organizations/organizations.repository.ts"
related_tests:
  - "apps/api/test/business-access-foundation.test.ts"
  - "apps/api/test/organizations.controller.test.ts"
  - "tests/unit/worker-service-membership.test.mjs"
related_endpoints:
  - "GET /v1/organizations"
  - "GET /v1/organizations/:orgId"
  - "GET /v1/organizations/:orgId/members"
  - "POST /v1/auth/refresh"
  - "POST /v1/auth/logout"
related_events: []
related_agents: []
last_verified: "2026-10-11"
---
# DEC-R1 — Access Foundation

**Owner authorization:** Owner instructed Astra to continue implementation on 2026-10-11, following review and conditional technical approval of DEC-R1. Approval is scoped to a feature branch and draft PR; **does not authorize merge, Railway configuration or deployment**.

**Base inspected:** `main` 4b3b51625167045e1549cbe14e80e12aa55d133c. Parent design: `docs/program/semse-4d-field-memory/COMPANY_INVITATIONS_DETAILED_SPEC.md`. Historical `docs/specs/api/session-revocation-architecture.spec.md` is REVIEW and records a previous Railway latency incident. This slice supersedes its prior acceptance of stale bearer tokens **only for the agreed scope**, with a fail-closed deadline; production release needs measured performance and owner approval.

## Problem and scope

Persisted sessions are presently not rechecked per API request; session insertion is fire-and-forget; renewal can reuse stale roles. Organization reads filter on tenant alone and `ActorContextService.ensureActorContext` writes placeholder Tenant/Org/User on reads. These are isolation and integrity risks. A professional's global User remains portable while each Org membership is independently scoped.

Included: verify persisted active session and effective role for bearer access, role revocation at next authorization, atomic refresh rotation, await session persistence before issuing bearer tokens, pure organization listing/detail/members with backend membership policy. Maintain global permission decorators; effective roles may only narrow a claimed role. Nonexistent, suspended or cross-tenant resources must not disclose details. Keep service bootstrap and worker semantics separately inventoried and tested; a bootstrap secret by itself must never grant a human role unsupported by active membership.

Excluded: employment offers, invites, wages, TimeEntry, Evidence writes, Org context switching, Railway, migrations, new API endpoints or global roles.

## Contract / acceptance

- **AC-01/02:** Two orgs within one tenant and another tenant; only active memberships accessible; OPS_ADMIN tenant-scoped, never cross-tenant; empty list 200.
- **AC-03:** Logged-out/revoked/expired/unknown sid yields 401 at next request without waiting for token expiry.
- **AC-04:** Suspended membership or removed role immediately narrows access to Org A while independent membership in Org B remains valid.
- **AC-05:** Missing identity 401; valid identity without permission 403; invisible resource 404.
- **AC-06:** Dependency errors/deadline fail closed with 503; target access resolution deadline defaults to 1 second; no claims-only fallback. Measure latency in staging; no production SLO asserted.
- **AC-07:** `issueSession` awaits durable AuthSession before returning bearer. Failure emits no usable token; no Session is created on read.
- **AC-08:** Organization GET has no `ensureActorContext`, placeholder upsert, or mutation.
- **AC-09:** Worker/BFF bootstrap and service-account behavior tested, cannot self-elevate from caller-supplied roles. Do not remove established machine identity without an approved replacement. *(2026-10-12: el worker de producción, `usr_worker_system`, no tenía membresías y quedó en 401 tras el deploy; hotfix operativo en `docs/runbooks/WORKER_SERVICE_IDENTITY_MEMBERSHIP.md`, sin cambio de lógica de auth.)*
- **AC-10:** Client's org selector/cookie cannot bypass scoped membership; API resolves effective permissions server-side.
- **AC-11:** Two refresh requests using the same opaque token cannot both succeed; revocation and rotation are transactionally guarded.
- **AC-12:** No AUTH_SECRET in production does not enable header-derived identity, including `resolveRequestContext`.

## Authority and failure semantics

`ResourceScope` remains canonical. `OrgActor.roles` must originate from the verified effective context, not free headers. Non-admin organization listing is membership-scoped; detail/member reads require both membership and the global permission decorator. The existing OPS_ADMIN exception is limited to current tenant. No new role or grant.

Revoked session returns 401; unavailable database returns 503 (no login redirect loops); invisible Org returns 404. Auth data privacyCritical: never log password, tokens, members or secret. Use existing audit action catalogue; no new event names.

## Delivery gates

1. Spec, plan, tasks, checklist and tests are versioned before implementation.
2. `pnpm spec:validate:strict`, build, targeted and regression tests must pass.
3. Review the BFF and worker bootstrap path explicitly; reject any regression or bypass.
4. Open draft PR with SHA, test evidence and outstanding risks.
5. Only a separate authorized release may merge/deploy; canary with synthetic A/B membership and latency metrics is mandatory.
