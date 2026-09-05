# WorkItem: CP-IMPL-004 — F4 persistencia aditiva

**Estado:** COMPLETE_BUILDER_VERIFIED  
**Riesgo:** critical  
**Tasks:** T-040..T-048  
**Tasks digest autorizado:**
`sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa`  
**Git:** waiver humano vigente para workspace sin metadata utilizable

## Autoridad

El owner autorizó expresamente:

- registrar el importer vacío `packages/control-plane` en `pnpm-lock.yaml`;
- ejecutar F4 completa, incluida edición Prisma, migration SQL aditiva,
  repository de capabilities y tests PostgreSQL locales;
- ejecutar `prisma validate`, `generate`, `migrate diff` y una DB efímera/local;
- resolver y documentar problemas dentro de estos límites.

## Allowed paths

- `pnpm-lock.yaml` exclusivamente para el importer vacío autorizado;
- `packages/db/prisma/schema.prisma`;
- `packages/db/prisma/migrations/20260719000000_semse_os_capability_control_plane/migration.sql`;
- `apps/api/src/modules/capabilities/capabilities.repository.ts`;
- `apps/api/test/capability-persistence.integration.test.ts`;
- migration plan, tasks, este WorkItem, TaskPacket, reportes y DecisionPackage.

## Prohibido

- F5+, controllers/services/modules HTTP, RBAC/seed y registro en AppModule;
- worker, queue, executor, Docker/WSL o runtime adapter real;
- Railway, staging, deploy, producción o bases/datos no locales;
- down destructivo, `db push`, secretos literales o edición de `.env`;
- branch, commit o push.

## Stop conditions

Detener si la migration exige alterar/eliminar tablas existentes, si una prueba
solo puede ejecutarse contra una base no local o si el repository requiere
implementar endpoints/worker de fases futuras.

## Resultado

- T-040..T-048 completadas dentro de los allowed paths.
- Importer vacío registrado y frozen-lockfile offline PASS.
- Prisma validate/generate PASS; migration completa aplicada solo a PostgreSQL
  local efímero mediante `prisma dev`.
- 8/8 pruebas F4 PASS, incluidos CP-005/006/011/012 y query plans indexados.
- F5+, Docker, Railway, deploy y producción permanecen ausentes.
- Revisión independiente Data Architecture + Security/QA continúa reservada
  para F9; este estado no equivale a autorización productiva.
