---
id: "fsm-reservation-lifecycle"
title: "Reservation Lifecycle FSM"
domain: "reservations"
version: "1.1"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "apps/api/src/modules/reservations"
  - "apps/api/src/common/domain-store.ts"
related_tests:
  - "scripts/api-reservations-smoke.mjs"
  - "apps/api/test/reservations.contract.test.ts"
related_endpoints:
  - "v1/reservations"
related_events:
  - "reservation.accept"
related_agents: []
last_verified: "2026-07-23"
---

# FSM Spec: Reservation Lifecycle

## States

| State | Description | Terminal | Reversible |
| --- | --- | --- | --- |
| `held` | Reservation is active and holds the job temporarily. | No | Yes, via release/expire. |
| `accepted` | Reservation has been accepted and should move the job toward execution/acceptance. | Yes | No through this FSM. |
| `released` | Reservation was manually released. | Yes | No; create a new reservation if needed. |
| `expired` | Reservation TTL elapsed or operator expired it. | Yes | No; create a new reservation if needed. |

## Transitions

| From | Event | To | Guard | Effects |
| --- | --- | --- | --- | --- |
| `held` | `reservation.accept` | `accepted` | Reservation belongs to tenant and is not expired. | Audit `reservation.accept`. |
| `held` | `reservation.release` | `released` | Reservation belongs to tenant. | Audit `reservation.release`; job can be reopened. |
| `held` | `reservation.expire` | `expired` | Reservation belongs to tenant or sweep detects TTL expiry. | Audit `reservation.expire` for explicit expire; sweep returns counts. |

## Diagram

```txt
              ┌──────────► accepted
              │
held ─────────┼──────────► released
              │
              └──────────► expired
```

## Invariants

- Only `held` reservations can transition.
- Terminal reservations cannot be accepted, released or expired again except through idempotent service behavior explicitly documented later.
- Reservation TTL must be between 1 and 1440 minutes.
- Visible response must not expose internal-only fields.
- Every explicit transition writes audit.
- Expiration sweep may transition only a row that is still `held` and still
  expired at mutation time.
- Reopening a job must not overwrite a status changed after sweep selection.

## Tests Required

- [x] API smoke for reservation flow.
- [x] Unit test for `held -> accepted`.
- [x] Unit test for `held -> released`.
- [x] Unit test for `held -> expired`.
- [x] Unit test that terminal states reject further transitions.
- [x] Race test that a concurrent `accepted` state survives stale sweep
  selection.

## Implementation Map

### API

- `apps/api/src/modules/reservations/reservations.service.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`

### Tests

- `apps/api/test/reservations.contract.test.ts`
- `scripts/api-reservations-smoke.mjs`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] Reservation API references this FSM.
- [x] Expiration sweep does not bypass tenant-safe repository behavior.
- [x] Sweep counters reflect successful compare-and-set mutations only.
