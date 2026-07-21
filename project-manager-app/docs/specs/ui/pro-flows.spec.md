---
id: ui-pro-flows
title: "Pro Contractor UI Flows"
type: spec
feature: "Pro (Contractor) UI Flows"
domain: "ui"
version: "1.0"
status: "REVIEW"
owner: semse-core
risk: high
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/web/app/pro
  - apps/web/app/(app)/tools
  - apps/web/components/tools
  - apps/api/src/modules/tools
related_tests:
  - tests/e2e-semse/pro-tools-concrete.spec.ts
  - tests/e2e-semse/pro-tools-dashboard.spec.ts
  - tests/e2e-semse/tools-api-routes.spec.ts
related_endpoints:
  - v1/tools
  - v1/jobs
related_events:
  - milestone.submitted
related_agents:
  - protools
last_verified: 2026-06-09
---

# Spec: Pro UI Flows

> **REVIEW 2026-07-20.** `related_files`/`related_tests` muestran que este spec cubre específicamente el catálogo ProTools, no la app completa del rol PRO (`/worker/*`), que nunca tuvo spec propio — ver `docs/specs/ui/pro-flows-remediation.spec.md`. Además, la auditoría del 2026-07-20 confirmó en producción que `POST /api/semse/agents/protools/estimate` responde 404 — contradice el `status: VERIFIED` anterior de este archivo. Requiere re-verificación antes de volver a `VERIFIED`.

> Flujos de interfaz para el rol PRO (contratista) en SEMSE OS.

---

## Flujo 1: Explorar y hacer bid en jobs

**Página:** `/marketplace`
**API calls:** `GET /v1/jobs?status=posted` → `POST /v1/jobs/:jobId/bids`

| Estado visual | Condición |
|--------------|-----------|
| Lista de jobs publicados | Siempre |
| Filtros (categoría, presupuesto, urgencia) | Sidebar |
| Card de job | title, scope preview, budgetMin-Max, urgency |
| Modal "Hacer oferta" | Al hacer click en job |
| Formulario bid | amount (positive), etaDays (int) |
| Confirmación | Tras crear bid |
| "Ya tienes una oferta" badge | Si PRO ya hizo bid |

---

## Flujo 2: Subir evidencia y someter milestone

**Página:** `/projects/:projectId/milestones/:milestoneId`
**API calls:** `POST /v1/evidence/presign` → upload → `POST /v1/evidence` → `POST /v1/milestones/:id/submit`

| Estado visual | Condición |
|--------------|-----------|
| Estado del milestone | Badge de status |
| Upload zone | Cuando status=awaiting_review |
| Preview de archivos | Tras seleccionar |
| Progress bar | Durante upload |
| Lista de evidencia subida | Evidencias registradas |
| Botón "Someter a revisión" | Solo si evidenceCount > 0 |
| Disabled si sin evidencia | Con tooltip explicativo |
| Loading | Durante submit |
| SSE update | Al aprobar/rechazar (CLIENT) |

**Transiciones FSM:** `awaiting_review → submitted`

---

## Flujo 3: Ver feedback de rechazo y corregir

**Página:** `/projects/:projectId/milestones/:milestoneId`

| Estado visual | Condición |
|--------------|-----------|
| Banner "Rechazado" | Cuando status=rejected |
| Razón de rechazo | rejectionReason visible |
| Upload zone activa | Para nueva evidencia |
| Botón "Volver a someter" | Tras nueva evidencia |

---

## Flujo 4: Usar ProTools para estimar trabajo

**Página:** `/tools/:trade` (ej. `/tools/painting`, `/tools/drywall`)
**API calls:** `POST /v1/buildops/estimates/from-tool-result`

| Estado visual | Condición |
|--------------|-----------|
| Formulario de la herramienta | Dimensiones, materiales, condiciones |
| Cálculo en tiempo real | Mientras el PRO completa |
| Resultado con breakdown | Total, por fase, por material |
| Botón "Usar en proyecto" | Para vincular al BuildOpsProject |

---

## Flujo 5: Configurar método de cobro

**Página:** `/profile/payout`
**API calls:** `GET /v1/workers/me/payout-method` → `POST /v1/workers/me/payout-method`

| Estado visual | Condición |
|--------------|-----------|
| Método actual | Si existe |
| Formulario por tipo | bank_account, paypal, zelle, cashapp |
| Validación por tipo | routing/account para bank_account, email para paypal |
| Confirmación | Tras guardar |

---

## Flujo 6: Solicitar review y ver job completado

**Página:** `/projects/:projectId`
**API calls:** `POST /v1/jobs/:jobId/transition { targetStatus: "review" }`

| Estado visual | Condición |
|--------------|-----------|
| Botón "Solicitar revisión final" | Cuando job IN_PROGRESS + todos milestones PAID |
| Confirmación modal | Antes de la acción |
| Estado "En revisión" | Tras submit |
| Notificación de cobro | Cuando payment.released via SSE |

---

## Estados visuales globales del PRO

| Estado | Descripción |
|--------|-------------|
| Dashboard `/dashboard` | Jobs activos, milestones pendientes de evidencia |
| Notificaciones SSE | milestone.approved, milestone.rejected, payment.released |
| Historial de cobros | `/payments` — lista de releases |
