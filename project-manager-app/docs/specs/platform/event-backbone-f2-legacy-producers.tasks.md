---
type: tasks
feature: "Event backbone F2 — slice 1: disputas"
domain: "platform"
plan: "docs/specs/platform/event-backbone-f2-legacy-producers.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "feat/event-backbone-f2-disputes"
date: "2026-11-10"
---

# Tareas — Event backbone F2, slice 1: disputas

## Fase 0 — Preflight

- [x] **T-001** Rama `feat/event-backbone-f2-disputes` apilada sobre la spec aprobada (`docs/legacy-event-bus-outbox-spec`, PR #1137).
- [x] **T-002** Confirmar que no hace falta migración: `DomainOutboxEvent` y `DomainEventConsumption` ya existen (F1).

## Fase 1 — Contratos y tests

- [x] **T-010** Esquemas v2 de los 5 eventos en `packages/schemas/src/domain-events-v2.schema.ts` (payload strict, solo referencias, `entityId` = `disputeId`).
- [x] **T-011** Tests en `apps/api/test/dispute-events-v2.test.ts`: flag (D1), envelope, atomicidad, modos off/shadow/on, paridad de los 5 tipos, bus audit-only, consumidor shadow/on/duplicado/terminal y registro → DLQ.
- [x] **T-012** Control negativo: sin los cambios de servicio, bus y repositorio fallan 6 de los 15 tests.

## Fase 2 — Implementación

- [x] **T-020** Hook transaccional `withinTx` en `DisputesRepository` (camino sin hook idéntico al anterior).
- [x] **T-021** `dispute-events-v2.ts`: resolver del flag, builder v2 con modo sellado y reconstructor del evento legacy.
- [x] **T-022** `DisputesService`: hook en `shadow`/`on`; emit legacy en `audit-only` en `on`.
- [x] **T-023** `DomainEventBus.emit(..., { effects: "audit-only" })`.
- [x] **T-024** `DisputeEffectsConsumer` (`dispute-effects.v1`) y registro de los 5 tipos.

## Fase 3 — Validación y entrega

- [x] **T-030** `tsc --noEmit`, build de la API y suite unitaria de la API.
- [x] **T-031** `pnpm spec:validate:strict`, `spec:audit-plan-coverage` y `spec:index:check`.
- [ ] **T-032** CI verde del PR.
- [ ] **T-033** Merge (tras #1137) y deploy con el modo en `off`.
- [ ] **T-034** Activación por el dueño: allowlists → `shadow` → comparación → `on` (plan §2).
- [ ] **T-035** PR de cierre: retirar el `emit()` legacy de disputas cuando todos los tenants estén en `on`.
