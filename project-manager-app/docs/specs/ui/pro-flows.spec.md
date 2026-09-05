---
id: ui-pro-flows
title: "Pro Contractor UI Flows"
type: spec
feature: "Pro (Contractor) UI Flows"
domain: "ui"
version: "1.1"
status: "DEPRECATED"
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

> **DEPRECATED 2026-08-14 — auditoría de re-verificación completa.** Este spec quedó en `REVIEW` desde 2026-07-20 pendiente de una re-auditoría antes de volver a `VERIFIED` (motivo original: `POST /api/semse/agents/protools/estimate` daba 404 en producción). Esa auditoría se hizo ahora — conclusión: no es un caso de "un endpoint roto, el resto correcto". **Los 6 "Flujos" de este documento describen una implementación huérfana/superseded que no corresponde a la app real del rol PRO.**
>
> **Evidencia (código, 2026-08-14):**
> - Ninguna de las rutas descritas existe tal cual: `/marketplace`, `/dashboard`, `/tools/:trade`, `/profile/payout` no son las rutas reales del rol PRO — la app real vive bajo `/worker/*` (dashboard, jobs, tracker, payments, profile, evidence, etc.), documentada en detalle y con evidencia en vivo en `docs/specs/ui/pro-flows-remediation.spec.md` (`APPROVED`).
> - El "Flujo 4" (ProTools) apunta a `POST /v1/buildops/estimates/from-tool-result` y a `/tools/:trade` — esa ruta (`apps/web/app/(app)/tools/**`) **existe en código pero no está en la navegación del rol `worker` en absoluto** (`apps/web/app/(app)/layout.tsx`, array `NAV.worker.items`) — solo aparece en `NAV.client.items` (como `/client/protools`, ruta distinta) y en `ADMIN_NAV_ITEMS` como quick-link de Admin. Un PRO no tiene ningún camino de navegación real hacia `/tools/:trade`.
> - Confirmación definitiva: los propios `related_tests` de este spec (`tests/e2e-semse/pro-tools-concrete.spec.ts`, `pro-tools-dashboard.spec.ts`) hacen `tryLoginAs(page, "admin")` — prueban `/tools` como **Admin**, no como PRO. La suite que este spec cita como su propia cobertura nunca probó el rol que dice especificar.
>
> **No re-escrito porque no hace falta:** `pro-flows-remediation.spec.md` ya documenta la app real del rol PRO con el mismo nivel de detalle (o mayor) que este archivo intentaba, con evidencia en vivo. Este archivo queda solo como referencia histórica de una implementación de rutas ya superseded — no usar para autorizar implementación nueva.

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
