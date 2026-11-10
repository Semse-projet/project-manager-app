---
type: tasks
feature: "Event backbone F2 — slice 2: milestones (con fan-out del registro)"
domain: "platform"
plan: "docs/specs/platform/event-backbone-f2-milestones.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "feat/event-backbone-f2-fanout"
date: "2026-11-10"
---

# Tareas — Event backbone F2, slice 2: milestones

## 2a — Fan-out del registro (PR `feat/event-backbone-f2-fanout`, apilado sobre #1138)

- [x] **T-201** `domain-event-fanout.ts`: agrupación con detección de duplicados, `appliesTo` y `dispatchToConsumers`.
- [x] **T-202** `DomainEventConsumerService.process` usa el fan-out; se elimina el chequeo 1:1 de allowlist.
- [x] **T-203** Tests `apps/api/test/domain-event-fanout.test.ts` (7): registro, compatibilidad 1:1, `appliesTo`, agregación, precedencia reintentable > terminal, consumidor no habilitado ⇒ 503 tras correr los demás, servicio sin cambios para tipos de un solo consumidor.
- [x] **T-204** Control por mutación: sin la precedencia reintentable ni el 503 final, fallan 2 tests.
- [x] **T-205** Suites de consumidores existentes en verde: evidence-readiness/F1, satellite-webhooks, jobs-bids, lifecycle, agent-run, disputas.
- [ ] **T-206** CI verde y merge tras #1138.

## 2b — Milestones (PR siguiente)

- [x] **T-210** Decisión D5 del dueño (2026-11-10): las instrucciones de `revision_requested` viajan en el payload.
- [ ] **T-211** Esquemas v2 `milestone.created/submitted/revision_requested.v1`.
- [ ] **T-212** Hook `withinTx` en `MilestonesRepository.create/transitionStatus`; flag `SEMSE_MILESTONE_EVENTS_V2_MODE`.
- [ ] **T-213** `approved`/`rejected.v1` transaccionales en `shadow`/`on` (D4); best-effort intacto en `off`.
- [ ] **T-214** Consumidor `milestone-effects.v1` (fan-out con SAT-007) y tests de atomicidad, paridad, shadow/on, duplicado y DLQ.
