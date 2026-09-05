# WorkItem: CP-IMPL-003 — F1 tests, F2 schemas y F3 núcleo puro

**Estado:** COMPLETED_WITH_F4_PLUS_BLOCKED
**Riesgo:** high dentro de un spec critical
**Tasks autorizadas:** T-010..T-038
**Tasks digest autorizado:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`
**Plan digest F0:**
`sha256:0061f87bd22fc6f0d29b8c5827b8a31c2e55a277af5cb04a8dd110308405d489`
**Git:** waiver humano para trabajar sin rama/commit por metadata no utilizable

## Autoridad

El owner autorizó T-008/T-009 exclusivamente para F1-F3. Está permitido:

- editar solo los paths de los tres TaskPackets asociados;
- usar Corepack e instalar el lockfile existente con `--frozen-lockfile`;
- crear el manifest nuevo exigido por T-030;
- ejecutar tests/build/typecheck locales afectados.

## Prohibido

- cambiar manifests existentes o `pnpm-lock.yaml`;
- `apps/api/src/**`, Prisma/migrations, worker product code o executor;
- Docker/WSL, Railway, CI/CD, deploy, producción o secretos;
- F4 en adelante;
- branch, commit o push bajo el waiver vigente.

Los test contracts T-014/T-015 pueden vivir en `apps/api/test/**`, pero no
autorizan ninguna edición en `apps/api/src/**`.

## Handoff

1. CP-F1 produce baseline rojo atribuible a módulos ausentes.
2. CP-F2 implementa schemas y cierra solo los tests de contratos.
3. CP-F3 implementa núcleo puro y cierra tests FSM/planner/policy.
4. Se publica evidencia y digest nuevo; F4 continúa bloqueada.

## Resultado

- F1: baseline rojo controlado y contratos F4+ explícitamente omitidos.
- F2: schemas estrictos y export canónico compilados.
- F3: FSM, manifest trust/semver, planner/digest, policy y adapter interface
  puros compilados y probados.
- Los 19 manifests existentes y `pnpm-lock.yaml` conservan sus digests iniciales.
- F4+, T-006, Docker, Prisma, API/worker product code, executor y producción no
  fueron ejecutados ni modificados.
