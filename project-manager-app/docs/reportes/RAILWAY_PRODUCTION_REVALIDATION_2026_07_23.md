# Railway Production Revalidation — 2026-07-23

Estado: `HEALTHY_WITH_RELEASE_PROVENANCE_DRIFT`.

Esta comprobación retoma el cierre del release F1–F4 documentado en
[`RAILWAY_PRODUCTION_RELEASE_2026_07_19.md`](RAILWAY_PRODUCTION_RELEASE_2026_07_19.md).
Fue exclusivamente read-only: no se cambiaron variables, configuración,
servicios, deployments ni datos.

## Scope observado

- Project: `SEMSEproject` (`95ad1b14-d1d9-467d-82d8-5354619ba873`).
- Environment: `production` (`d682210a-956a-4508-9c5b-4ca5959278f9`).
- Corte de health HTTP: `2026-07-24T01:05:55Z`
  (`2026-07-23 18:05:55 America/Los_Angeles`).

Railway reportó todos los servicios del entorno en `SUCCESS`, incluidos
Postgres y Redis. Los deployments activos de las tres superficies del release
son:

- API: `d2fb8c73-b7db-4b00-a2ed-6ab888639e17`, `SUCCESS`.
- Worker: `be4d0d5c-54dc-4096-b41f-7005f872c65d`, `SUCCESS`.
- Web: `3cab3bda-9bed-40b8-9182-1bc8deb84c42`, `SUCCESS`.

Los tres fueron creados alrededor de `2026-07-24T00:40Z` desde el commit
`f60c60b048d6900c1a393cab1ed095b7a3d94e7d`.

## Procedencia del artefacto activo

GitHub identifica el commit activo como:

`fix(ui): evita breadcrumb duplicado y href cross-rol en ClientBreadcrumbs (1.12) (#407)`.

La inspección del snapshot exacto confirmó:

- `project-manager-app/packages/control-plane/package.json`: ausente.
- `project-manager-app/packages/db/prisma/migrations/20260719000000_semse_os_capability_control_plane/migration.sql`:
  ausente.
- `project-manager-app/infra/railway/api.railway.json`: presente; declara
  `node scripts/pre-migrate.mjs && node apps/api/dist/main.js`,
  healthcheck `/v1/health` y timeout de 300 segundos.

Por tanto, los IDs del release aprobado del 19 de julio ya no están activos y
el commit canónico desplegado no contiene el paquete ni la migration que
formaban el candidato F1–F4. La migration F4 permanece aplicada en PostgreSQL,
pero esta revalidación no certifica el runtime actual como el mismo artefacto
ligado al release digest
`9d7cc04a830be473b975070811adf3250040232c29f4c9c238ee3501f3e80778`.

## Evidencia operativa actual

- API `/v1/health`: HTTP 200, `status=ok`.
- API `/v1/ready`: HTTP 200, `status=ready`.
- Readiness observada: database `ok`, migrations `ok`, Redis `ok` y worker
  heartbeat `ok`.
- Web `/api/semse/healthz`: HTTP 200, `status=ok`.
- Web `/`: HTTP 200.
- API y worker: sin deploy logs de nivel error en la ventana consultada.
- API y web: sin respuestas HTTP 5xx en la ventana consultada.
- Web: una advertencia no bloqueante de Next.js porque `metadataBase` no está
  definido; el fallback observado fue `http://localhost:3000`.

## Conclusión y siguiente gate

Producción está operativamente sana, pero existe deriva de procedencia:
`healthy` no equivale a que el release F1–F4 aprobado siga activo.

No se re-subió el candidato anterior porque reemplazaría cambios canónicos
posteriores, incluido PR #407, y volvería a ser desplazado por el próximo
auto-deploy. El siguiente release debe:

1. integrar F1–F4 y su migration en la fuente canónica actual;
2. resolver o verificar el binding efectivo del config-as-code;
3. generar un nuevo digest y aprobación sobre la cabeza vigente;
4. desplegar y exigir `SUCCESS`, readiness, migraciones y evidencia de
   procedencia antes de declarar F1–F4 activo otra vez.
