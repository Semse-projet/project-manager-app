---
id: ui-client-flows
title: "Client UI Flows"
type: spec
feature: "Client UI Flows"
domain: "ui"
version: "1.0"
status: "DEPRECATED"
owner: semse-core
risk: high
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/web/app/(app)/client
  - apps/web/app/jobs
  - apps/web/components/milestones
  - apps/web/app/components/payments
related_tests:
  - tests/e2e/project-manager.spec.js
  - tests/e2e-semse/payments-flow.spec.js
  - tests/e2e-semse/buildops-milestones.spec.ts
related_endpoints:
  - v1/jobs
  - v1/milestones
  - v1/payments
related_events:
  - milestone.approved
  - payment.released
related_agents: []
last_verified: 2026-06-09
---

# Spec: Client UI Flows

> **DEPRECATED 2026-07-20.** Los flujos documentados aquí (`/jobs/new`, `/jobs/:jobId`, `/jobs/:jobId/payments`) describen una implementación que ya no tiene ningún enlace de navegación en producción — quedó huérfana cuando el flujo real migró a `/client/*`. Ver `docs/specs/ui/client-flows-remediation.spec.md` para el contrato vigente. Se conserva este archivo como referencia histórica de esa ruta, no como fuente de verdad.

> Flujos de interfaz para el rol CLIENT en SEMSE OS (apps/web).
> Cada flujo especifica: qué datos carga, qué acciones expone y qué estados visuales existen.

---

## Flujo 1: Publicar un Job

**Página:** `/jobs/new`
**Rol:** CLIENT
**API calls:** `POST /v1/jobs`

| Estado visual | Condición |
|--------------|-----------|
| Formulario vacío | Inicial |
| Validación inline | title < 5, scope < 10, budgetMin > budgetMax |
| Loading | Submit en progreso |
| Redirect `/jobs/:id` | Éxito |
| Error toast | 4xx del API |

**Acciones:** Completar formulario → Submit → Publicar (transition DRAFT→POSTED)
**Transiciones FSM disparadas:** `draft → posted`

---

## Flujo 2: Revisar bids y aceptar uno

**Página:** `/jobs/:jobId`
**API calls:** `GET /v1/jobs/:jobId/bids` → `POST /v1/bids/:bidId/accept`

| Estado visual | Condición |
|--------------|-----------|
| Lista de bids | Cuando status=POSTED |
| Empty state | Sin bids aún |
| Botón "Aceptar" | Por cada bid |
| Confirmación modal | Antes de aceptar |
| Loading skeleton | Al cargar bids |
| Redirect a milestones | Tras aceptar |

**Acciones:** Ver bids → Comparar → Aceptar
**Transiciones FSM:** job `posted → reserved → accepted`

---

## Flujo 3: Aprobar o rechazar milestone

**Página:** `/jobs/:jobId/milestones` o `/projects/:projectId`
**API calls:** `GET /v1/projects/:projectId/milestones` → `POST /v1/milestones/:id/approve` | `reject`

| Estado visual | Condición |
|--------------|-----------|
| Lista milestones | Siempre |
| Badge de estado | Por milestone: DRAFT / READY / SUBMITTED / APPROVED / REJECTED / PAID |
| Panel de evidencia | Cuando milestone SUBMITTED |
| Botones "Aprobar" / "Rechazar" | Solo cuando status=SUBMITTED |
| Modal de razón | Al rechazar (reason requerido) |
| Loading | Durante acción |
| Notificación SSE | Cuando PRO somete milestone |

**Acciones:** Ver evidencia → Aprobar / Rechazar con razón
**Transiciones FSM:** `submitted → approved` | `submitted → rejected`

---

## Flujo 4: Ver estado financiero del job

**Página:** `/jobs/:jobId/payments`
**API calls:** `GET /v1/jobs/:jobId/escrow` + `GET /v1/jobs/:jobId/payments` + `GET /v1/jobs/:jobId/payment-readiness`
**Roles permitidos:** CLIENT, OPS_ADMIN (PRO no puede ver financials)

| Estado visual | Condición |
|--------------|-----------|
| Resumen escrow | Siempre (amount, status, currency) |
| Lista transacciones | Historial FUND/RELEASE/REFUND |
| Payment readiness | Por milestone: ready/blocked/released |
| Blockers list | Cuando canRelease=false |
| Empty state | Sin escrow creado |

---

## Flujo 5: Abrir disputa

**Página:** `/jobs/:jobId` → modal "Abrir disputa"
**API calls:** `POST /v1/disputes`

| Estado visual | Condición |
|--------------|-----------|
| Botón visible | Solo cuando job en IN_PROGRESS o REVIEW |
| Modal con textarea | Al hacer click |
| Validación inline | reason < 10 chars |
| Loading | Submit |
| Success toast + redirect | Tras crear |

**Transiciones FSM:** job `in_progress → dispute`

---

## Flujo 6: Fondear escrow

**Página:** `/jobs/:jobId/escrow/fund`
**API calls:** `POST /v1/jobs/:jobId/escrow/fund`

| Estado visual | Condición |
|--------------|-----------|
| Formulario de pago | Monto, proveedor, método |
| Validación amount | amount > 0 |
| Procesando | Durante request |
| Confirmación | Tras fondear exitosamente |

---

## Estados visuales globales del CLIENT

| Estado | Descripción |
|--------|-------------|
| Dashboard `/dashboard` | Jobs activos, milestones pendientes, alertas |
| Notificaciones | SSE: milestone.submitted, payment.released, dispute.opened |
| Inbox `/communications` | Mensajes WhatsApp de PROs asignados |
