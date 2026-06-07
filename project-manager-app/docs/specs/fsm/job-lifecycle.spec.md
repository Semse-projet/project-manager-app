---
id: fsm-job-lifecycle
title: "Job FSM"
type: spec
feature: "Job FSM"
domain: "jobs"
version: "1.0"
status: "APPROVED"
owner: semse-core
risk: high
date: "2026-05-20"
spec_index: "docs/SPEC_INDEX.md"
source_of_truth: "apps/api/src/modules/jobs/jobs.service.ts — JOB_TRANSITIONS"
related_files:
  - apps/api/src/modules/jobs/jobs.service.ts
  - apps/api/src/modules/jobs/jobs.controller.ts
  - packages/schemas/src/job.schema.ts
related_tests:
  - apps/api/test/jobs.fsm.test.ts
  - apps/api/test/jobs.service.test.ts
related_endpoints:
  - v1/jobs
related_events:
  - job.status_changed
related_agents:
  - marketplace
last_verified: 2026-05-25
---

# FSM Spec: Job Lifecycle

## Estados y transiciones completos

```
DRAFT ──► POSTED ──► RESERVED ──► ACCEPTED ──► IN_PROGRESS ──► REVIEW ──► COMPLETED
  │         │                        │               │                         ▲
  │         │                        │               ▼                         │
  └──► CANCELLED ◄───────────────────┘          DISPUTE ────────────────────────┘
                                                    │
                                                    └──► CANCELLED

AWARDED ──► IN_PROGRESS  (flujo alternativo de adjudicación directa)
PUBLISHED  (alias externo de POSTED)
```

## Tabla canónica

| Estado | Transiciones permitidas | Actor autorizado |
|--------|------------------------|-----------------|
| `draft` | posted, cancelled | CLIENT, OPS_ADMIN |
| `posted` | reserved, cancelled | PLATFORM, OPS_ADMIN |
| `published` | reserved, cancelled | PLATFORM, OPS_ADMIN |
| `reserved` | accepted, posted | PLATFORM, OPS_ADMIN |
| `accepted` | in_progress, cancelled | CLIENT, OPS_ADMIN |
| `in_progress` | review, dispute | PRO (review/dispute), OPS_ADMIN |
| `review` | completed, in_progress | CLIENT (completed), PRO (in_progress), OPS_ADMIN |
| `dispute` | completed, cancelled | OPS_ADMIN |
| `awarded` | in_progress | PLATFORM, OPS_ADMIN |
| `completed` | — | TERMINAL |
| `cancelled` | — | TERMINAL |

## Guards de negocio

| Transición | Guard |
|-----------|-------|
| `draft → posted` | title ≥ 5 chars, scope ≥ 10 chars |
| `posted → reserved` | reserva activa, sin conflicto de concurrencia |
| `reserved → accepted` | reserva no expirada, bid aceptado |
| `accepted → in_progress` | contrato activo (ACTIVE) |
| `in_progress → review` | solo actor PRO o OPS_ADMIN |
| `review → completed` | solo actor CLIENT o OPS_ADMIN |
| `* → dispute` | solo actor PRO o OPS_ADMIN; causa formal requerida |
| `* → cancelled` | solo actor CLIENT o OPS_ADMIN |

## Efectos por transición

| Transición | Audit | Evento | Efecto financiero |
|-----------|-------|--------|------------------|
| `draft → posted` | `job.transition` | `job.status_changed` | — |
| `reserved → accepted` | `job.transition` | `job.status_changed` | materializa Project |
| `in_progress → dispute` | `job.transition` | `job.status_changed` | escrow → DISPUTED |
| `review → completed` | `job.transition` | `job.status_changed` | desbloquea cierre financiero |
| `dispute → completed` | `job.transition` | `job.status_changed` | según resolutionType de disputa |

## Invariantes

- Los estados terminales (`completed`, `cancelled`) no se reabren sin policy explícita de OPS_ADMIN
- `awarded` no está en STATE_MACHINES.md canónico — es un estado de implementación para flujo directo
- `PARTIALLY_PAID` fue planificado pero no implementado — el ciclo de pagos parciales se gestiona a nivel de milestone
