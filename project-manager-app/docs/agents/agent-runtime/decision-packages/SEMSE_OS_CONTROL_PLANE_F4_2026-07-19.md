# DecisionPackage — SEMSE OS Control Plane F4

**Estado:** READY_FOR_OWNER_REVIEW  
**Fecha:** 2026-07-19  
**Decisión ejecutada:** F4/T-040..T-048 únicamente  
**Producción:** NOT_AUTHORIZED

## Inputs autorizados

- tasks de entrada:
  `sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa`;
- permiso humano: importer vacío del control plane y F4 completa, incluidos
  Prisma, migration y PostgreSQL local;
- waiver Git vigente;
- exclusiones: F5+, API/worker/executor, Docker, Railway, deploy y producción.

## Output verificable

- tasks actualizado:
  `sha256:7bb5528f692518a16bd8ecabe42c5fcd735a7ba76eb0d7966f3fc04edb5bb4d9`;
- bundle F4:
  `sha256:387b122079644b93d0de54525a373efe43d4fe10c944063f3c7f0162e4945f8d`;
- lockfile con importer:
  `sha256:934df9a42e123224041d8ac45adc08313600f894ace6e135108d45864a0e3f6d`;
- PostgreSQL real local: 8 tests pass, 0 fail y 0 skip;
- Prisma validate/generate PASS; 64 migrations aplicadas localmente;
- diff sin diferencias F4; deriva global preexistente declarada;
- SDD estricto 78/0/0 y regresiones de arnés 17/0 + 5/0.

## Decisión propuesta

Aceptar F4 como implementación local completa dentro del scope autorizado. El
resultado certifica el boundary de persistencia del builder, no una revisión
independiente F9 ni autorización de API, ejecución o producción.

F5 solo puede iniciar con aprobación humana nueva ligada al digest actual de
tasks. La deuda `@nestjs/event-emitter` fue autorizada y resuelta posteriormente
retirando un servicio huérfano; no se añadió una dependencia ni se inició F5.

## Riesgos residuales

1. La base impone constraints por fila; invariantes cross-row/cross-tenant se
   refuerzan en repository, y API/RBAC aún no existe hasta F5.
2. El event type genérico de transición debe quedar alineado con el catálogo y
   schemas canónicos al implementar T-058.
3. El diff global contiene deriva histórica fuera de F4 que debe tratarse en un
   paquete de baseline separado.
4. El servidor `prisma dev` es solo evidencia local efímera; no sustituye
   staging, backup/restore ni revisión operacional.
5. T-006 sigue bloqueada y por ello también bloquea F7/T-094.

## Referencia

Reporte completo:
`docs/reportes/SEMSE_OS_CONTROL_PLANE_F4_2026_07_19.md`.
