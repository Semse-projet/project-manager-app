---
type: spec
feature: "Admin / OPS UI Flows"
domain: "ui"
version: "1.0"
status: "APPROVED"
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: Admin / OPS UI Flows

> Flujos de interfaz para OPS_ADMIN en `/admin` de SEMSE OS.

---

## Flujo 1: Mission Control — Visión general del ecosistema

**Página:** `/admin/ai-mission-control`
**API calls:** `GET /v1/ops/ai-mission-control/summary` + SSE `/v1/ops/events`

| Estado visual | Condición |
|--------------|-----------|
| Cards de estado por módulo | Agentes, RAG, SSE, Prometeo |
| Lista de incidentes activos | Ordenada por severidad |
| Señales de riesgo | color-coded: low/medium/high/critical |
| Live SSE panel | Eventos en tiempo real |
| ObserverPanel | Snapshot actual del Observer |

---

## Flujo 2: Consciousness Index — Madurez del sistema

**Página:** `/admin/consciousness`
**API calls:** `GET /v1/ops/consciousness/index`

| Estado visual | Condición |
|--------------|-----------|
| Score circular (0-100) | Centro de la página |
| Autonomy Level badge | 1-5 con descripción |
| Grid de módulos | hasBackend/hasFrontend/hasSSE/hasRAG/hasTests |
| Trend histórico | Evolución del score en el tiempo |
| Query box | Para hacer preguntas al Consciousness |

---

## Flujo 3: Revisar y resolver disputas

**Página:** `/admin/disputes`
**API calls:** `GET /v1/disputes` → `POST /v1/disputes/:id/assign` → `POST /v1/disputes/:id/resolve`

| Estado visual | Condición |
|--------------|-----------|
| Lista disputas | Filtradas por status (OPEN/UNDER_REVIEW/RESOLVED) |
| Detail panel | Al seleccionar disputa |
| Evidencias vinculadas | Lista de evidenceIds |
| Botón "Asignar revisor" | Cuando OPEN |
| Selector "resolutionType" | client_favor / pro_favor / partial_50_50 / escalated_legal |
| Campo "resolution" | Texto libre requerido |
| Botón "Resolver" | Cuando UNDER_REVIEW |
| Confirmación + audit trail | Tras resolver |

---

## Flujo 4: Evidence Review Panel

**Página:** `/admin/evidence-review`
**API calls:** `GET /v1/projects/:id/evidence` + AI review result

| Estado visual | Condición |
|--------------|-----------|
| Lista de evidencias SUBMITTED | Pendientes de review |
| AI review result | reviewStatus, confidence, riskLevel, findings |
| ragCitations | Fuentes del RAG usadas |
| Botones "Override" | Aceptar/Rechazar manualmente |
| Badge "privacyCritical" | Cuando review usó Ollama |

---

## Flujo 5: Aprobar plan BuildOps

**Página:** `/admin/buildops` o `/admin/projects/:id`
**API calls:** `POST /v1/buildops/plans/:id/approve`

| Estado visual | Condición |
|--------------|-----------|
| Plan de milestones | Lista con amounts y ETAs |
| Botones "Aprobar" / "Cambios" / "Rechazar" | Cuando PENDING_REVIEW |
| Campo de comentario | Opcional para approve, recomendado para cambios |
| SSE notification | PRO notificado en tiempo real |

---

## Flujo 6: Audit Log

**Página:** `/admin/audit`
**API calls:** `GET /v1/ops/audit`

| Estado visual | Condición |
|--------------|-----------|
| Tabla de eventos | Paginada, filtrable por entityType/action/actor |
| Detalle expandible | afterJson por evento |
| Exportar CSV | Para compliance |

---

## Estados visuales globales del ADMIN

| Panel | URL | Descripción |
|-------|-----|-------------|
| Dashboard | `/admin` | KPIs globales, alertas activas |
| Mission Control | `/admin/ai-mission-control` | Agentes, LLMs, señales |
| Consciousness | `/admin/consciousness` | Score de madurez |
| Disputes | `/admin/disputes` | Gestión de conflictos |
| Evidence | `/admin/evidence-review` | Revisión de evidencias |
| BuildOps | `/admin/buildops` | Aprobación de planes |
| Audit | `/admin/audit` | Historial completo |
| Communications | `/communications` | Inbox WhatsApp |
