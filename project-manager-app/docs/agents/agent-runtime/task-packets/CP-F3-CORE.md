# TaskPacket CP-F3 — Núcleo puro `@semse/control-plane`

**Tasks:** T-030..T-038
**Estado:** COMPLETE
**Builder:** Control Plane Core Builder
**Verifier futuro:** Architecture/QA Verifier independiente
**Tasks digest autorizado:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`

## Allowed paths

- `packages/control-plane/package.json` (manifest nuevo de T-030)
- `packages/control-plane/tsconfig.json`
- `packages/control-plane/src/types.ts`
- `packages/control-plane/src/manifest.ts`
- `packages/control-plane/src/fsm.ts`
- `packages/control-plane/src/planner.ts`
- `packages/control-plane/src/policy.ts`
- `packages/control-plane/src/runtime-adapter.ts`
- `packages/control-plane/src/index.ts`
- tests F1 de FSM/planner/policy estrictamente necesarios.

## Contrato de pureza

- sin NestJS, Prisma, BullMQ, child_process, Docker, filesystem, network, env o
  packages de agentes;
- planner y digests deterministas;
- policy recibe inputs y devuelve decision, nunca resuelve identidad/I/O;
- RuntimeAdapter es solo interface/operations cerradas;
- no dependencia runtime nueva ni cambio al lockfile.

## Verificación

- tests CP-003/004/007 y FSM;
- build/typecheck del paquete;
- búsqueda negativa de imports prohibidos;
- F4+ permanece ausente y bloqueada.

## Stop conditions

Detener si el core necesita I/O o cambios en root/package manifests existentes,
lockfile, API, Prisma, worker, executor o Docker.

## Evidencia de salida

- `@semse/control-plane` compila como paquete ESM puro;
- tests FSM/planner/policy pasan con publisher trust explícito, semver,
  dependencias, digest estable, default-deny y dual control;
- búsqueda negativa sin imports/referencias a NestJS, Prisma, BullMQ,
  child_process, Docker, filesystem, red, env ni agents.
