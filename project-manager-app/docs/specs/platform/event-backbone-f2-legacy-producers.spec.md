---
id: "platform.event-backbone-f2-legacy-producers"
title: "Event backbone F2 — migrar los productores que siguen en el bus legacy"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-11-10"
author: "Claude"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "docs/specs/platform/event-backbone.spec.md"
  - "apps/api/src/modules/domain-events/domain-event-bus.service.ts"
  - "apps/api/src/modules/domain-events/agent-trigger-router.service.ts"
  - "apps/api/src/modules/domain-events/outbox.repository.ts"
  - "apps/api/src/modules/domain-events/domain-event-consumer.service.ts"
  - "apps/api/src/modules/notifications/notifications.service.ts"
  - "apps/api/src/modules/disputes/disputes.service.ts"
  - "apps/api/src/modules/milestones/milestones.service.ts"
  - "apps/api/src/modules/jobs/jobs.service.ts"
  - "apps/api/src/modules/users/users.service.ts"
  - "apps/api/src/modules/ratings/ratings.service.ts"
related_tests: []
related_endpoints: []
related_events:
  - "dispute.opened"
  - "dispute.resolved"
  - "milestone.submitted"
  - "milestone.approved"
  - "milestone.rejected"
  - "job.completed"
  - "rating.submitted"
related_agents:
  - "trust-match"
  - "dispute"
  - "evidence-coach"
last_verified: "2026-11-10"
---

# Spec: Event backbone F2 — productores que siguen en el bus legacy

> **APPROVED por el dueño el 2026-11-10** (decisiones D1–D4 de §5, todas con la opción propuesta). Cada slice se
> implementa con su propio plan/tasks y PR. Continúa `platform.event-backbone-f1` (APPROVED), cuya decisión 7 fija el
> rollout "por productor/consumidor; el bus v1 permanece compatible mientras se migra cada dominio". Origen:
> AUDIT_REMEDIATION_PLAN 0.49e. Inventario verificado por lectura de código sobre `main` (`db92934`, 2026-11-10).

## 1. Problema y resultado

**Para quién:** los usuarios que esperan una notificación o una reacción de un agente tras un cambio de estado, y Ops,
que necesita ver y reprocesar lo que falló.

**Problema:** F1 dejó el outbox transaccional, el dispatcher, la DLQ y el replay listos, y los aplicó a evidencia, a
`job.status_changed.v1` y a los eventos de proyección del ciclo de vida. El resto de productores siguen emitiendo por
`DomainEventBus.emit()`, **después** del commit y fuera de la transacción:

- el `AuditLog` se escribe (se espera), pero las notificaciones y el router de triggers de agentes son best-effort;
- el router reintenta 3 veces y después **descarta el error con un log**: no hay DLQ ni replay para estos eventos;
- un fallo del proceso entre el commit y el `emit` pierde el evento sin rastro.

**Resultado esperado:** cada evento listado en §2 se escribe en `DomainOutboxEvent` dentro de la misma transacción que
su cambio de estado, y sus consumidores (notificaciones y triggers de agentes) lo procesan desde el outbox, con receipt
idempotente, DLQ y replay. El bus legacy deja de tener productores propios.

## 2. Inventario actual (2026-11-10)

| Productor | Eventos legacy | Outbox hoy | Consumidores legacy | Riesgo si se pierde |
|---|---|---|---|---|
| `disputes.service` | 5 llamadas (`dispute.opened`, `evidence_submitted`, `under_review`, `resolved`, `assigned`/`archived`/`restored`) | No | Notificaciones; agente `dispute` (en `dispute.opened`) | Las partes no se enteran de la disputa ni de su resolución; el agente de disputas no arranca. **El bloqueo de liberación de escrow NO depende del evento**: `PaymentsService.release` lee `hasOpenDisputeForProject` del estado. |
| `milestones.service` | 6 llamadas (`milestone.created`, `submitted`, `approved`, `rejected`, `revision_requested`) | Sí, pero **best-effort fuera de transacción** para `approved`/`rejected` (SAT-007) | Notificaciones; agente `evidence-coach` (en `submitted`) | Sin aviso de aprobación o rechazo; el evidence-coach no se activa. Los webhooks de satélites pueden perder `milestone.*.v1`. |
| `jobs.service` | 4 llamadas (eventos de creación, asignación y cierre del job) | `job.status_changed.v1` transaccional (repositorio); `job.completed.v1` y `rating.requested.v1` **best-effort fuera de transacción** (SAT-007) | Notificaciones; agente `trust-match` (en `job.created`) | Sin aviso de asignación o cierre; no se pide la calificación; el matching no arranca. |
| `ratings.service` | 1 (`rating.submitted`) | No | Notificaciones | Sin aviso de calificación recibida. |
| `users.service` | 1 (`user.verified`) | No | Auditoría | Bajo. |
| `domain-events.service` | 1 (ingesta genérica) | No | Router | Depende del evento ingerido. |
| `agro-domain-events` | Espejo de auditoría agro (`agro.incident.*`, `agro.worker_capability.verified`) | Ver `agro.domain-events` | — | Ya tiene spec propia; fuera de este F2. |

Lo que **ya cumple** F1 y no se toca: evidencia (`evidence.uploaded.v1`), `job.status_changed.v1`, la proyección del
ciclo de vida de proyecto y el consumidor `agent-run-finalization`.

## 3. Alcance propuesto

### Incluido

- Un evento v2 versionado (envelope F1 §5) por cada evento legacy de §2, escrito en la transacción del cambio de estado
  (F1 §8). Por ejemplo, `dispute.opened.v1` o `milestone.submitted.v1`, o se reutiliza el ya existente.
- Pasar `milestone.approved.v1`/`rejected.v1`, `job.completed.v1` y `rating.requested.v1` de best-effort a
  transaccionales. SAT-007 sigue consumiéndolos sin cambios.
- Consumidores v2 idempotentes (`DomainEventConsumption`) para:
  - notificaciones: mismo `notificationsService.handleEvent`, alimentado desde el outbox;
  - triggers de agentes: misma regla de `agent-trigger-router`, alimentada desde el outbox.
- Retirar el `emit()` legacy de cada productor una vez su consumidor v2 esté activo (sin dual-write, F1 §6).

### Fuera de alcance

- Cambiar qué notificaciones se envían o qué agentes se disparan.
- Kafka, Debezium o Temporal (F1, decisión 2).
- El bloqueo de pagos por disputa: ya lee estado, no eventos.
- Agro: tiene su propio spec (`agro.domain-events`).

## 4. Slices propuestos (orden por impacto en usuario)

1. **Disputas**: los 5 eventos y el trigger del agente `dispute`.
2. **Milestones**: los 6 eventos. `approved`/`rejected` pasan a transaccionales; además, el trigger de `evidence-coach`.
3. **Jobs**: los legacy restantes, más `job.completed.v1`/`rating.requested.v1` transaccionales y el trigger de `trust-match`.
4. **Ratings y users.**
5. **Ingesta genérica** (`domain-events.service`) y retiro del router legacy: el bus queda solo como adaptador de
   auditoría, o desaparece si §5-D3 lo decide.

Cada slice repite el patrón F1: productor transaccional → consumidor idempotente → tests de atomicidad, duplicado, DLQ
y replay → activación por flag de tenant → retiro del `emit()` legacy.

## 5. Decisiones del dueño (2026-11-10)

Las cuatro se aceptaron con la propuesta de la tabla.

| ID | Decisión | Propuesta (aceptada) |
|---|---|---|
| D1 | Cambio por slice: ¿flag por tenant con periodo de observación (como `project-lifecycle`), o cambio directo? | Flag por tenant, en `shadow` primero: el consumidor v2 registra sin notificar y se compara con lo que envía el legacy. |
| D2 | Orden de los slices | §4 (disputas primero, porque es lo más sensible para el usuario). |
| D3 | Destino final de `DomainEventBus` | Dejarlo solo como adaptador que escribe `AuditLog` hasta mover la auditoría al consumidor v2; retirarlo en el slice 5. |
| D4 | Escrituras best-effort de SAT-007 (`milestone.*.v1`, `job.completed.v1`, `rating.requested.v1`) | Hacerlas transaccionales en sus slices: el payload no cambia, solo la garantía de entrega. |

## 6. Invariantes (una vez migrado cada slice)

- Ningún cambio de estado de §2 se confirma sin su evento en el outbox, ni a la inversa.
- Cada consumidor procesa cada evento como máximo una vez por `(eventId, consumerName)`.
- Un consumidor que falla de forma persistente deja el evento en `DEAD_LETTER`, visible y reprocesable por Ops (F1 §11).
- No hay dual-write v1 + v2 para un productor migrado.

## 7. Tests requeridos (por slice, antes de implementar)

- [ ] Atomicidad: si falla el insert del outbox, se revierte el cambio de estado, y viceversa.
- [ ] Duplicado: la doble entrega no duplica la notificación ni el trigger.
- [ ] DLQ y replay: un fallo persistente termina en `DEAD_LETTER` y el replay lo reprocesa.
- [ ] Paridad en `shadow`: lo que hace el consumidor v2 coincide con lo que hacía el legacy.

## 8. Rollback

Por slice: apagar el flag del tenant vuelve al `emit()` legacy, que se conserva hasta cerrar cada slice. Los eventos ya
escritos en el outbox se pueden dejar en `DEAD_LETTER` o descartar con la operación de Ops existente.
