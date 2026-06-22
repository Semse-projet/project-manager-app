---
id: "api-reservations"
title: "Job Reservations API"
domain: "reservations"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/api/src/modules/reservations"
  - "packages/schemas/src/job.schema.ts"
  - "apps/api/src/common/visible-response.ts"
related_tests:
  - "scripts/api-reservations-smoke.mjs"
  - "apps/api/test/reservations.contract.test.ts"
related_endpoints:
  - "v1/reservations"
related_events:
  - "reservation.create"
related_agents: []
last_verified: "2026-06-09"
---

# Spec: Job Reservations API

## Problem Statement

Reservations temporarily hold a job for a professional or workflow before acceptance. They prevent double-booking and provide explicit release/expire paths while preserving auditability.

## Scope

- In scope:
  - List reservations for a job.
  - Create reservation with TTL.
  - Accept, release and expire a reservation.
  - Sweep expired reservations.
  - Return visible reservation payloads.
- Out of scope:
  - Payment capture.
  - Contract signing.
  - Bid acceptance logic outside reservation transition effects.

## API Contract

### `GET /v1/jobs/:jobId/reservations`

```yaml
auth: required
permissions: ["reservations:read"]
output:
  reservations: "visible reservations for job"
```

### `POST /v1/jobs/:jobId/reservations`

```yaml
auth: required
permissions: ["reservations:create"]
input:
  expiresInMinutes: "optional integer 1-1440, default 30"
output:
  reservation:
    status: "held"
effects:
  audit_log: "reservation.create"
errors:
  400: "expiresInMinutes outside 1-1440"
```

### `POST /v1/reservations/:reservationId/accept`

```yaml
auth: required
permissions: ["reservations:accept"]
precondition: "reservation is held and not expired"
effects:
  audit_log: "reservation.accept"
```

### `POST /v1/reservations/:reservationId/release`

```yaml
auth: required
permissions: ["reservations:release"]
precondition: "reservation is held"
effects:
  audit_log: "reservation.release"
```

### `POST /v1/reservations/:reservationId/expire`

```yaml
auth: required
permissions: ["reservations:expire"]
effects:
  audit_log: "reservation.expire"
```

### `POST /v1/reservations/sweep-expired`

```yaml
auth: required
permissions: ["reservations:expire"]
input:
  maxItems: "optional number, capped at 200, default 50"
output:
  expiredCount: number
  jobsReopened: number
```

## FSM

Canonical reservation lifecycle is defined in `docs/specs/fsm/reservation-lifecycle.spec.md`.

```txt
held -> accepted
held -> released
held -> expired
```

## Security / RBAC

- All calls resolve tenant, org, user and roles from request context.
- `toVisibleReservation` must be used to avoid leaking internal fields.
- Sweep endpoint is operational and must require expiration permission.

## Tests Required

- [x] Smoke: `scripts/api-reservations-smoke.mjs`
- [x] Unit/controller tests for TTL validation.
- [x] Tenant isolation tests.
- [x] Idempotency/conflict tests for terminal reservations.

## Implementation Map

### API

- `apps/api/src/modules/reservations/reservations.controller.ts`
- `apps/api/src/modules/reservations/reservations.service.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`

### Tests

- `scripts/api-reservations-smoke.mjs`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] Reservation transitions are auditable.
- [x] Expired reservations can be swept safely.
- [x] Visible response hides internal-only data.
