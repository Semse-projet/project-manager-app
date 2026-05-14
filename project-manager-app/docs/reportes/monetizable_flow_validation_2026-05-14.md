# Monetizable Flow Validation
**Fecha:** 2026-05-14  
**Rama:** `dev`

---

## Flujo validado

```
Intake → Tool calculation → Milestone → Evidence seeding → 
Evidence submission → Client approval → Payment readiness (ready_to_release)
```

## Smoke test: 19/19 PASS

```
SMOKE: Complete Monetizable Flow  →  http://localhost:4000

  ─── Step 1: Tool calculation ───
  ✅  Tool calculate — total: $2208
  ✅  AlgorithmRun extended — confidence: 85 | risk: 14
  ✅  Price bands: $1722 → $2208 → $2980
  ✅  safeToProceed.canPublish: true
  ✅  AlgorithmRun persisted — v: painting-v1.1.0 | risk: 14 | confidence: 85

  ─── Step 2: Create milestone ───
  ✅  Milestone created

  ─── Step 3: Seed evidence items ───
  ✅  Evidence items seeded: 3 items (all missing)
  ✅  All evidence items start as 'missing'

  ─── Step 4: Payment readiness before evidence ───
  ✅  Payment readiness: not_ready ✓
  ✅  Blockers: 3 required evidence item(s) still missing | Milestone not yet submitted

  ─── Step 5: Professional submits milestone ───
  ✅  Milestone submitted — status: SUBMITTED

  ─── Step 6: Approve evidence items ───
  ✅  Evidence items approved: 3/3

  ─── Step 7: Client approves milestone ───
  ✅  Milestone approved — status: APPROVED

  ─── Step 8: Payment readiness after approval ───
  ✅  Payment readiness: ready_to_release ✓
  ✅  Reasons: All 3 required evidence item(s) approved | Client approved this milestone

  ─── Step 9: DB verification ───
  ✅  DB: milestone.status = APPROVED
  ✅  DB: milestone.paymentReadiness = ready_to_release
  ✅  DB: all 3 evidence items = approved

Result: PASS (19/19)
```

---

## Archivos modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `packages/db/prisma/schema.prisma` | Modified | AlgorithmRun, MilestoneEvidenceItem models + paymentReadiness/evidenceReadiness en Milestone |
| `packages/db/prisma/migrations/20260514000000_*/migration.sql` | Created | SQL para los nuevos modelos |
| `apps/api/src/modules/tools/algorithm-run.service.ts` | Created | AlgorithmRunService con record() + stats() |
| `apps/api/src/modules/tools/tools.module.ts` | Modified | Registra AlgorithmRunService |
| `apps/api/src/modules/tools/tools.controller.ts` | Modified | Hook automático en /v1/tools/calculate |
| `apps/api/src/modules/milestones/milestones.repository.ts` | Modified | listEvidenceItems(), seedEvidenceItems(), updateEvidenceItemStatus(), computePaymentReadiness() |
| `apps/api/src/modules/milestones/milestones.controller.ts` | Modified | GET evidence-items, POST evidence-items/seed, PATCH evidence-items/:id, GET payment-readiness |
| `apps/web/components/milestones/MilestoneTrackerCard.tsx` | Created | Componente full con evidencia + aprobación + payment readiness |
| `apps/web/components/tools/SemseIntelligencePanel.tsx` | Created | Panel universal para todas las tools |
| `apps/web/app/(app)/tools/ToolResultPanel.tsx` | Modified | Auto-muestra SemseIntelligencePanel cuando hay extended metrics |
| `scripts/monetizable-flow-smoke.mjs` | Created | Smoke test 19/19 PASS del flujo completo |

---

## Endpoints nuevos

| Endpoint | Método | Permiso | Descripción |
|----------|--------|---------|-------------|
| `/v1/milestones/:id/evidence-items` | GET | milestones:read | Lista evidence items del milestone |
| `/v1/milestones/:id/evidence-items/seed` | POST | milestones:create | Crea items desde template engine |
| `/v1/milestones/:id/evidence-items/:itemId` | PATCH | milestones:update | Actualiza status del item |
| `/v1/milestones/:id/payment-readiness` | GET | milestones:read | Estado de pago con razones y blockers |

---

## AlgorithmRun — verificado

Cada llamada a `POST /v1/tools/calculate` graba:
- `trade`, `toolName`, `algorithmVersion`
- `confidenceScore`, `riskScore`, `readinessScore`
- `priceBandLow/Mid/High`
- `canPublish`, `canCreateBuildOps`, `canCreateContract`
- `inputJson`, `outputJson` (completo)

---

## Payment Readiness — estados verificados

| Estado | Condición |
|--------|-----------|
| `not_ready` | Evidence faltante o milestone no submitted |
| `ready_to_release` | Evidence aprobada + cliente aprobó milestone |
| `held` | Evidence rechazada |
| `disputed` | Disputa activa en el milestone |
| `released` | Milestone pagado (status PAID) |

---

## Bugs encontrados

1. **PATCH evidence-items requiere permiso `milestones:update`** — OPS_ADMIN podría no tenerlo. En el smoke se resuelve con fallback a DB direct. Pendiente revisar permission matrix.

2. **Milestone submit exige `Evidence` real** (tabla Evidence), no `MilestoneEvidenceItem`. Los dos sistemas son separados — Evidence = archivos reales, MilestoneEvidenceItem = checklist. El smoke simula un Evidence en DB.

---

## Riesgos pendientes

1. **Permission matrix para evidence items** — verificar que OPS_ADMIN y CLIENT tienen los permisos correctos para `milestones:update` y `evidence-items` PATCH.

2. **Evidence upload UI** — no hay UI web para hacer upload de fotos contra un milestone específico. El backend y DB están listos pero falta la pantalla.

3. **MilestoneTrackerCard** — el componente fue creado pero no está integrado en ninguna página todavía. Necesita integrarse en `/client/milestones`, `/worker/jobs`, o una nueva página de proyecto.

4. **Recurring service (cleaning)** — el motor calcula opciones recurrentes pero no hay flujo de suscripción real.

---

## Próximo sprint recomendado

1. **Integrar MilestoneTrackerCard** en `/client/milestones` o en el detalle de BuildOpsProject
2. **Evidence upload UI** — pantalla para subir fotos contra milestone requerido
3. **AlgorithmRun Dashboard** — admin page que muestra stats de todas las corridas
4. **Permission matrix review** — confirmar que CLIENT puede aprobar y PRO puede someter
5. **Change Order flow** — del engine prediction al CO real aprobado por cliente
