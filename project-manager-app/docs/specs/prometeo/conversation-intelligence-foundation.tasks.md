---
type: tasks
feature: "conversation-intelligence-foundation"
domain: "prometeo"
plan: "docs/specs/prometeo/conversation-intelligence-foundation.plan.md"
version: "1.0"
status: "PLANNED"
branch: "feat/conversation-intelligence-foundation"
date: "2026-10-02"
---

# Tareas: Conversation Intelligence Foundation

## Wave 0 — contratos / tests
- [x] [CI-001] Inspeccionar schema y servicios reales; registrar AS-IS sin crear dominios paralelos. → `conversation-intelligence-foundation.as-is.md` (2026-10-06).
- [x] [CI-002] Definir contrato `SourceRef` y `IntelligenceFinding`. → `packages/schemas/src/conversation-intelligence.schema.ts` (2026-10-06).
- [x] [CI-003] Reutilizar convención canónica de `correlationId`; no inventar valores legacy. → AS-IS §4: no existe convención única; opcional y solo con valor real (2026-10-06).
- [ ] [CI-004] Tests de mapping Session -> CommunicationThread/Communication.
  > CI-004, CI-005 y CI-006 prueban funciones que aún no existen (mapping, hash, scope). Escribirlas en rojo no se puede mergear, así que se entregan **junto con** CI-012 (mapping) y CI-013 (dual-write), primero los tests y después el código dentro del mismo PR.
- [ ] [CI-005] Tests de orden estable, `contentHash` e idempotencia.
- [ ] [CI-006] Tests tenant/resource scope y cross-tenant denial.
- [x] [CI-007] Tests fact vs finding; confirmar que no se escriben Decision/Action/Outcome. → `tests/unit/conversation-intelligence-contracts.test.ts` (2026-10-06).

## Wave 1 — DB / dual-write
- [ ] [CI-010] Extender `Communication` con `sequence`, `occurredAt`, `contentHash` nullable.
- [ ] [CI-011] Crear migración e índices versionados.
- [ ] [CI-012] Implementar mapping canónico y external IDs deterministas.
- [ ] [CI-013] Implementar dual-write detrás de flag.
- [ ] [CI-014] Telemetría de success/failure sin contenido crudo.

## Wave 2 — backfill / equivalencia
- [ ] [CI-020] Backfill por tenant/lotes.
- [ ] [CI-021] Ejecutar backfill dos veces y demostrar ausencia de duplicados.
- [ ] [CI-022] Shadow compare legacy vs canónico.
- [ ] [CI-023] Medir mismatch y documentar umbral/materialidad.

## Wave 3 — retrieval
- [ ] [CI-030] Filtros exactos tenant/thread/user/project/job.
- [ ] [CI-031] Búsqueda literal/subcadena.
- [ ] [CI-032] PostgreSQL FTS `simple` + ranking determinista.
- [ ] [CI-033] Reconstrucción completa del thread en orden estable.
- [ ] [CI-034] Retornar provenance con `SourceRef[]`.

## Wave 4 — Prometeo
- [ ] [CI-040] Registrar `conversations.count`.
- [ ] [CI-041] Registrar `conversations.search`.
- [ ] [CI-042] Registrar `conversations.get`.
- [ ] [CI-043] Registrar `conversations.context`.
- [ ] [CI-044] Registrar `conversations.audit`.
- [ ] [CI-045] Registrar `conversations.compare`.
- [ ] [CI-046] Validar governance/policy para cada tool.

## Wave 5 — rollout / cierre
- [ ] [CI-050] Validar modo `off`.
- [ ] [CI-051] Validar `shadow` sin afectar respuesta.
- [ ] [CI-052] Canary por tenant configurado.
- [ ] [CI-053] `spec:validate:strict`, typecheck, build y tests verdes.
- [ ] [CI-054] Registrar CI, merge SHA y deployment.
- [ ] [CI-055] Smoke autenticado y evidencia de canary.
- [ ] [CI-056] Cambiar spec a VERIFIED solo después de todos los gates.
