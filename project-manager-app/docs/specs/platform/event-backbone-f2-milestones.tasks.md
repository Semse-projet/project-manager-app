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

## 2b — Milestones (PR `feat/event-backbone-f2-milestones`, apilado sobre 2a)

- [x] **T-210** Decisión D5 del dueño (2026-11-10): las instrucciones de `revision_requested` viajan en el payload.
- [x] **T-211** Esquemas v2 `milestone.created/submitted/revision_requested.v1` y `MILESTONE_V2_EVENT_TYPES`.
- [x] **T-212** Hook `withinTx` en `MilestonesRepository.create/transitionStatus`; flag `SEMSE_MILESTONE_EVENTS_V2_MODE`; `loadMilestoneEventContext` compartido con el consumidor.
- [x] **T-213** `approved`/`rejected.v1` transaccionales en `shadow`/`on` (D4); best-effort intacto en `off`; en `on` la notificación directa al profesional pasa al consumidor.
- [x] **T-214** Consumidor `milestone-effects.v1` (fan-out con SAT-007, `appliesTo` = modo sellado) y tests `apps/api/test/milestone-events-v2.test.ts` (14): flag, envelope, atomicidad, off/shadow/on, degradación sin hook, límite del motivo, paridad de los 5 tipos, consumidor shadow/on/duplicado/terminal y fan-out real con satélites.
- [x] **T-215** Control negativo: con servicio y repositorio del 2a, fallan 8 de 14.
- [x] **T-216** Motivo de `reject`/`requestChanges` limitado a 2000 caracteres antes de escribir (antes: commit y luego 500 al construir el evento SAT-007).
- [ ] **T-217** CI verde y merge tras 2a.
- [ ] **T-218** Activación (dueño): allowlists → `shadow` → comparar recibos → `on`; después, PR de cierre que retira los `emit()` legacy de milestones.
