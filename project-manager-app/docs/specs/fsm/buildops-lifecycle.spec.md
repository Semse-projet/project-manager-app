---
type: spec
feature: "BuildOps Plan FSM"
domain: "buildops"
version: "1.0"
status: "APPROVED"
date: "2026-05-20"
spec_index: "docs/SPEC_INDEX.md"
source_of_truth: "apps/api/src/modules/buildops/buildops-plan-approval.service.ts"
---

# FSM Spec: BuildOps Plan Lifecycle

## Estados y transiciones

```
PENDING_REVIEW ──► APPROVED ──► PROMOTED_TO_LEGACY
       │               │
       │         CHANGES_REQUESTED ──► (rerun) ──► APPROVED
       │               │
       └──────────── REJECTED [TERMINAL]
```

## Tabla canónica

| Estado | → Permitido | Actor | Guard |
|--------|------------|-------|-------|
| `pending_review` | `approved` | OPS_ADMIN | plan completo y válido |
| `pending_review` | `changes_requested` | OPS_ADMIN | comentario requerido |
| `pending_review` | `rejected` | OPS_ADMIN | razón de rechazo |
| `approved` | `promoted_to_legacy` | PLATFORM (automático) | sin timeout |
| `approved` | `changes_requested` | OPS_ADMIN | antes de promoción |
| `changes_requested` | `approved` | OPS_ADMIN (rerun) | plan corregido |
| `rejected` | — | — | TERMINAL |
| `promoted_to_legacy` | — | — | TERMINAL |

## Efectos por transición

| Transición | SSE | Audit | Efecto |
|-----------|-----|-------|--------|
| → `approved` | ✅ PRO notificado | `plan.approved` | habilita ejecución de milestones |
| → `changes_requested` | ✅ PRO notificado | `plan.changes_requested` | PRO debe corregir y resubmitir |
| → `rejected` | ✅ PRO notificado | `plan.rejected` | job puede necesitar nuevo plan |
| → `promoted_to_legacy` | — | `plan.promoted` | milestones del plan migran al ciclo principal |

## Invariantes

- `promoted_to_legacy` es idempotente — si ya está promovido, re-ejecutar no genera duplicados
- `REJECTED` es el único estado terminal sin promoción automática
- La transición `changes_requested → approved` requiere un nuevo "rerun" del plan
- El plan solo puede aprobarse si el job asociado está en `IN_PROGRESS` o `ACCEPTED`
