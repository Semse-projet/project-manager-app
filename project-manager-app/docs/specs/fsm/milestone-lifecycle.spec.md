---
id: fsm-milestone-lifecycle
title: "Milestone FSM"
type: spec
feature: "Milestone FSM"
domain: "milestones"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: critical
date: "2026-05-20"
spec_index: "docs/SPEC_INDEX.md"
source_of_truth: "apps/api/src/modules/milestones/milestones.policy.ts"
related_files:
  - apps/api/src/modules/milestones/milestones.policy.ts
  - apps/api/src/modules/milestones/milestones.service.ts
  - apps/api/src/modules/milestones/milestones.controller.ts
related_tests:
  - apps/api/test/milestones.spec-contract.test.ts
  - apps/api/test/milestones-fsm.test.ts
  - tests/e2e-semse/buildops-milestones.spec.ts
related_endpoints:
  - v1/milestones
related_events:
  - milestone.submitted
  - milestone.approved
related_agents:
  - evidence-coach
last_verified: 2026-06-09
---

# FSM Spec: Milestone Lifecycle

## Estados y transiciones

```
DRAFT ──► AWAITING_REVIEW ──► SUBMITTED ──► APPROVED ──► PAID [TERMINAL]
                                    │
                                    └──► REJECTED ──► AWAITING_REVIEW (nueva iteración)
```

## Mapeo código → producto

| Código DB | Término de producto | Visible al usuario |
|-----------|--------------------|--------------------|
| `draft` | DRAFT | "Borrador" |
| `awaiting_review` | READY | "Listo para someter" |
| `submitted` | SUBMITTED | "En revisión" |
| `approved` | APPROVED | "Aprobado" |
| `rejected` | REJECTED | "Rechazado" |
| `paid` | PAID | "Pagado" |

## Tabla canónica

| Estado | → Permitido | Guard | Actor |
|--------|------------|-------|-------|
| `draft` | `awaiting_review` | milestone configurado (title, amount, sequence) | PRO, OPS_ADMIN |
| `awaiting_review` | `submitted` | evidenceCount > 0 | PRO, OPS_ADMIN |
| `submitted` | `approved` | revisión válida | CLIENT, OPS_ADMIN |
| `submitted` | `rejected` | reason ≥ 1 char | CLIENT, OPS_ADMIN |
| `rejected` | `awaiting_review` | nueva iteración o subsanación | PRO, OPS_ADMIN |
| `approved` | `paid` | release financiero exitoso (PaymentGovernance) | PLATFORM (automático) |
| `paid` | — | TERMINAL | — |

## Guards de negocio (de milestones.policy.ts)

```typescript
assertMilestoneSubmittable:
  - actor debe ser PRO asignado o OPS_ADMIN
  - status debe ser "draft" | "rejected" | "awaiting_review"
  - evidenceCount > 0 (sin evidencia, submit rechazado con 409)

assertMilestoneApprovable:
  - actor debe ser CLIENT dueño o OPS_ADMIN
  - status debe ser "submitted"

assertMilestoneRejectable:
  - actor debe ser CLIENT dueño o OPS_ADMIN
  - status no puede ser "paid"
  - status debe ser "submitted" o "approved"
```

## Efectos por transición

| Transición | Audit | Evento | Efecto |
|-----------|-------|--------|--------|
| → `submitted` | `milestone.submit` | `milestone.submitted` | SSE, notifica CLIENT, EvidenceReviewService |
| → `approved` | `milestone.approve` | `milestone.approved` | SSE, PaymentGovernanceService, WorkspaceMemory |
| → `rejected` | `milestone.reject` | `milestone.rejected` | SSE, notifica PRO con rejectionReason |
| → `paid` | (vía escrow release) | `milestone.paid` | `payment.released`, SSE |

## Invariantes

- PRO no puede aprobar ni rechazar su propio milestone
- `paid` es el único estado terminal — no se reabre
- `approved → paid` solo ocurre tras release financiero exitoso en escrow
- La transición `rejected → awaiting_review` no es automática — requiere acción del PRO
