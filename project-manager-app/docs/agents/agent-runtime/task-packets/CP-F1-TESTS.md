# TaskPacket CP-F1 — Tests antes del código

**Tasks:** T-010..T-019
**Estado:** COMPLETE_WITH_FUTURE_SKIPS
**Depende de:** T-008/T-009 registrados
**Builder:** Control Plane Test Builder
**Verifier futuro:** QA Verifier independiente
**Tasks digest autorizado:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`

## Allowed paths

- `tests/fixtures/capabilities/**`
- `tests/unit/capability-fsm.test.ts`
- `tests/unit/capability-planner.test.ts`
- `tests/unit/capability-policy.test.ts`
- `tests/unit/capability-worker.test.mjs`
- `tests/unit/capability-compose-adapter.test.mjs`
- `apps/api/test/capabilities.controller.test.ts`
- `apps/api/test/capability-persistence.integration.test.ts`
- `tests/integration/capability-local-ai-runtime.test.mjs`

## Herramientas

- read/search, `apply_patch` y creación de directorios permitidos;
- Node test runner y scripts pnpm existentes;
- sin network salvo instalación exacta del lockfile autorizada en WorkItem.

## Criterio de salida

- fixtures válidos, incompatibles y maliciosos;
- CP-001..CP-014 representados por tests nominales/negativos;
- baseline rojo solo por módulos F2/F3/F4+ ausentes;
- tests que dependen de F4+ quedan explícitamente skipped con razón/task, no
  falsamente verdes;
- ningún product source editado.

## Stop conditions

Detener si el baseline requiere editar API source, Prisma, worker, executor,
Docker, manifests existentes o lockfile.

## Evidencia de salida

- baseline rojo: 4 imports F2/F3 ausentes, 15 skips F4+ y ningún fallo del arnés;
- selección final: tests F1-F3 activos verdes; contratos futuros conservan su
  task desbloqueadora en el nombre del `skip`;
- ningún archivo de product source fue editado.
