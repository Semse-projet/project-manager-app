---
id: "api-field-ops"
title: "Field Operations API"
domain: "field-ops"
version: "1.1"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/api/src/modules/field-ops"
  - "packages/schemas/src/tracker.schema.ts"
related_tests:
  - "apps/api/test/field-ops-tracker.test.ts"
  - "apps/api/test/field-ops.controller.test.ts"
  - "apps/api/test/field-ops-service.test.ts"
  - "apps/api/test/field-ops-parent-scope.test.ts"
  - "scripts/api-tracker-smoke.mjs"
related_endpoints:
  - "v1/field-ops"
related_events:
  - "tracker.session.started"
related_agents:
  - "buildops"
last_verified: "2026-07-25"
---

# Spec: Field Operations API

## Problem Statement

Field crews and contractors need a tenant-safe operational surface for units, daily worklogs and tracker sessions. Tracker activity must be auditable because it supports evidence, schedule, labor, dispute and payment context.

## Scope

- In scope:
  - Field units list/create/status update.
  - Worklog list/create.
  - Tracker snapshot.
  - Tracker start, manual create, pause, resume and stop.
  - Knowledge facts and their optional worklog link.
  - Vendors and compliance documents.
  - Audit events for tracker transitions.
- Out of scope:
  - Weather automation; see `docs/specs/tools/fase-2/m2.3-weather.spec.md`.
  - Anti-dispute evidence bundles; see `docs/specs/tools/fase-2/m2.2-dispute-docs.spec.md`.
  - Mobile app shell decisions.

## API Contract

### Field Units

```yaml
endpoints:
  - "GET /v1/field-ops/units"
  - "GET /v1/field-ops/units/:unitId"
  - "POST /v1/field-ops/units"
  - "PUT /v1/field-ops/units/:unitId/status"
permissions:
  read: "field-ops:read"
  write: "field-ops:write"
status_values:
  - "PENDING"
  - "IN_PROGRESS"
  - "COMPLETE"
  - "ON_HOLD"
  - "CANCELLED"
```

### Worklogs

```yaml
endpoints:
  - "GET /v1/field-ops/worklogs"
  - "POST /v1/field-ops/worklogs"
permissions:
  read: "field-ops:read"
  write: "field-ops:write"
create_input:
  fieldUnitId: "required"
  date: "YYYY-MM-DD"
  doneToday: "required"
  pendingNext: "required"
  blockers: "optional"
  notes: "optional"
```

### Tracker

```yaml
endpoints:
  - "GET /v1/field-ops/tracker"
  - "POST /v1/field-ops/tracker/start"
  - "POST /v1/field-ops/tracker/manual"
  - "POST /v1/field-ops/tracker/:sessionId/pause"
  - "POST /v1/field-ops/tracker/:sessionId/resume"
  - "POST /v1/field-ops/tracker/:sessionId/stop"
permissions:
  read: "field-ops:read"
  write: "field-ops:write"
tracker_status:
  - "RUNNING"
  - "PAUSED"
  - "STOPPED"
effects:
  audit_log:
    - "tracker.session.started"
    - "tracker.session.paused"
    - "tracker.session.resumed"
    - "tracker.session.stopped"
```

## FSM

```txt
none -> RUNNING
RUNNING -> PAUSED
PAUSED -> RUNNING
RUNNING -> STOPPED
PAUSED -> STOPPED
```

Invariants:

- A user may not start a second active/paused tracker session.
- Starting the same running job session can return the existing session.
- Pause only applies to `RUNNING`.
- Resume only applies to `PAUSED`.
- Elapsed seconds preserve accumulated time.

## Security / RBAC

- All queries are tenant-scoped.
- Every relational target supplied on a write is resolved by `{id, tenantId}`
  before inserting the child: project for a field unit, field unit for a
  worklog, optional worklog for a fact, and vendor for a compliance document.
- A missing or foreign relational target returns not found and performs no
  child write.
- Tracker sessions are scoped to the creating user.
- Audit logs must include tenant, org, actor, entity and request id.
- Field data may become evidence or dispute context; do not expose cross-tenant worklogs.

## Tests Required

- [x] Tracker elapsed time.
- [x] Tracker view serialization.
- [x] Note trimming and merge behavior.
- [x] Tracker API smoke script.
- [x] Controller tests for permissions.
- [x] Unit status transition conflict tests.
- [x] Parent IDs on units, worklogs, facts and compliance docs reject
  cross-tenant targets before writing.
- [ ] Integration DB verifies the four parent/child relations with two real
  tenants and evaluates composite `{id, tenantId}` foreign keys.

## Implementation Map

### API

- `apps/api/src/modules/field-ops/field-ops.controller.ts`
- `apps/api/src/modules/field-ops/field-ops.service.ts`
- `apps/api/src/modules/field-ops/field-ops.repository.ts`
- `apps/api/src/modules/field-ops/tracker-session.ts`

### Tests

- `apps/api/test/field-ops-tracker.test.ts`
- `apps/api/test/field-ops-service.test.ts`
- `apps/api/test/field-ops-parent-scope.test.ts`
- `scripts/api-tracker-smoke.mjs`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] `pnpm spec:validate` passes.
- [x] Tracker status transitions remain auditable.
- [x] Field units, worklogs, facts and vendor compliance writes are
  tenant-scoped in code with negative regressions.
- [ ] Complete DB-backed two-tenant verification before restoring `VERIFIED`.
