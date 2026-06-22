---
id: fsm-escrow-lifecycle
title: "Escrow FSM"
type: spec
feature: "Escrow FSM"
domain: "payments"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: critical
date: "2026-05-20"
spec_index: "docs/SPEC_INDEX.md"
source_of_truth: "docs/foundation/STATE_MACHINES.md — PaymentEscrow"
related_files:
  - apps/api/src/modules/payments
  - packages/db/prisma/schema.prisma
  - packages/schemas/src/payment.schema.ts
related_tests:
  - apps/api/test/payments.spec-contract.test.ts
  - apps/api/test/payment-governance.service.test.ts
  - tests/unit/payment-escrow-status-prisma.test.ts
related_endpoints:
  - v1/escrow
  - v1/payments
related_events:
  - payment.released
  - dispute.opened
related_agents:
  - crowd
  - Justus
last_verified: 2026-06-09
---

# FSM Spec: Escrow Lifecycle

## Estados y transiciones

```
PENDING ──► FUNDED ──► HELD
                         │
           ┌─────────────┤──────────────────────────┐
           ▼             │                          ▼
  PARTIALLY_RELEASED ◄───┤                      DISPUTED
           │             │                     ╱        ╲
           └─────────────┼────► RELEASED ◄─────         REFUNDED
                         │
                         └──► RELEASED (todos los milestones aprobados)

[TERMINALES: RELEASED, REFUNDED]
```

## Tabla canónica

| Estado | → Permitido | Guard | Actor |
|--------|------------|-------|-------|
| `pending` | `funded` | pago proveedor confirmado | PLATFORM |
| `funded` | `held` | sistema confirma recepción | PLATFORM |
| `held` | `partially_released` | milestone APPROVED + governance OK | PLATFORM vía release |
| `held` | `released` | todos los milestones aprobados + cierre total | PLATFORM vía release |
| `held` | `disputed` | disputa abierta en job | OPS_ADMIN / PLATFORM |
| `partially_released` | `held` | nuevo milestone pendiente | PLATFORM |
| `partially_released` | `released` | último milestone aprobado | PLATFORM |
| `disputed` | `held` | disputa resuelta sin money move | OPS_ADMIN |
| `disputed` | `released` | resolutionType = "pro_favor" | OPS_ADMIN |
| `disputed` | `refunded` | resolutionType = "client_favor" | OPS_ADMIN |

## Invariantes críticas

- **No liberar más de lo fondeado** — `releaseAmount ≤ (totalAmount - releasedSoFar)`
- **No pasar a RELEASED con ledger inconsistente**
- **Disputa activa bloquea releases no obligatorios** — `PaymentGovernanceService.canRelease = false`
- **RELEASED y REFUNDED son terminales** — sin reapertura posible

## Relación con Milestone FSM

```
milestone.APPROVED → PaymentGovernanceService.evaluate() → canRelease=true
    → escrow HELD → PARTIALLY_RELEASED | RELEASED
    → milestone → PAID
```

## Efectos de audit y SSE

| Transición | Evento | SSE |
|-----------|--------|-----|
| → `funded` | `payment.funded` | — |
| → `held` | `payment.held` | — |
| → `partially_released` | `payment.released` | ✅ canal proyecto |
| → `released` | `payment.released` | ✅ canal proyecto |
| → `disputed` | `dispute.opened` | — |
| → `refunded` | `payment.refunded` | — |
