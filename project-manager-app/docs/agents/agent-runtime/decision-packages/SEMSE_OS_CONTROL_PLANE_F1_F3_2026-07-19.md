# DecisionPackage — SEMSE OS Control Plane F1–F3

**Estado:** READY_FOR_OWNER_REVIEW  
**Fecha:** 2026-07-19  
**Decisión ejecutada:** F1–F3 únicamente  
**Producción:** NOT_AUTHORIZED

## Inputs autorizados

- tasks de entrada:
  `sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`;
- plan F0:
  `sha256:0061f87bd22fc6f0d29b8c5827b8a31c2e55a277af5cb04a8dd110308405d489`;
- permiso humano: T-008/T-009 para T-010..T-038, Corepack y frozen install;
- exclusiones: F4+, Prisma, API/worker source, executor, Docker, Railway,
  deploy y producción.

## Output verificable

- tasks actualizado:
  `sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa`;
- bundle source/test F1–F3:
  `sha256:fbea305b3e884783f9f6bded1d4cd9e34939716f7d4a23318336c042a9e966b0`;
- lockfile preservado:
  `sha256:2289dcd4082502f4ef1e0549f59067276fdcb0da479e5620febc939e679e3643`;
- 17 tests activos pass, 0 fail y 17 contratos futuros skip;
- builds de schemas/core pass;
- SDD estricto: 78 specs, 0 errores, 0 advertencias;
- arnés estático: 5/5 pass.

## Decisión propuesta

Aceptar F1–F3 como implementación local completa dentro del scope autorizado,
sin inferir autorización para F4, Docker o producción.

Antes de otro `pnpm install`, decidir de forma separada si se autoriza registrar
el importer vacío `packages/control-plane` en `pnpm-lock.yaml`. Esa decisión no
añade dependencias, pero sí cambia el lockfile y por ello quedó fuera del gate.

F4 solo puede iniciar con una aprobación humana nueva ligada al digest actual de
tasks y con autorización explícita para T-040..T-048, Prisma/migration y sus
pruebas PostgreSQL. T-006 no bloquea F4, pero continúa bloqueando F7/T-094.

## Riesgos residuales

1. API/IDOR, persistencia/leases/outbox, worker recovery y adapter real aún son
   contratos omitidos; no están certificados.
2. La confianza de firma entra al core como decisión/allowlist verificada; la
   verificación criptográfica y el registry pertenecen a fases posteriores.
3. No hubo verifier independiente ni Git diff utilizable; el inventario por
   paths y digests sustituye esa evidencia local, sin equivaler a revisión F9.
4. Docker/WSL sigue ausente; no existe evidencia de canary, readiness o rollback
   runtime.

## Referencia

Reporte completo:
`docs/reportes/SEMSE_OS_CONTROL_PLANE_F1_F3_2026_07_19.md`.

