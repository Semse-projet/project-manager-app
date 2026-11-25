# 2026-11-20 — OPEN-18: ubicación verificable de obra y vínculo Job/proyecto libre (servidor)

Decisión del propietario (2026-11-20): «Apruebo OPEN-18», incluidas las propuestas de Q1–Q3. PR #1168.

## Qué se implementó
- **Spec** `core.worksite-location-binding` → APPROVED v0.2, con plan, tasks y checklist.
- **Único cambio respecto de lo aprobado en v0.1:** la unicidad del vínculo activo usa `activeTargetKey` (clave
  nulable con índice único) en lugar de índices parciales, que Prisma no representa. La garantía es la misma y la
  verifica PG-01.
- **Migración** `20261120120000_worksite_location_binding`, aditiva y nulable:
  - columnas de ubicación en `Worksite`;
  - tabla `WorksiteBinding`;
  - `bindingId` y `consumedByTimeEntryId` en `GeofenceEvent`;
  - 3 CHECK en SQL.
  - `TimeEntry` intacto y sin backfill.
- **API**, todo tras `SEMSE_WORKSITE_BINDING_ENABLED`, apagado:
  - `PUT …/worksites/:worksiteId/location`;
  - vínculos: crear, listar y terminar;
  - `GET /v1/me/geofence-sites`;
  - `site` en `POST /v1/me/geofence-events`;
  - `proximity_auto` exige y consume una decisión `AUTO_START_ALLOWED` del servidor (AC-08).
- **Eventos nuevos en el catálogo:** `worksite.location_set` y `worksite_binding.created/ended`. Se registró
  también `location_preference.changed`, que ya se emitía pero faltaba en el catálogo.

## Evidencia (local)
- **Unitarias nuevas:** `worksite-location-binding.test.ts`. Junto con `geofence-policy` y los tests del Labor
  Engine: 91 tests, 0 fallos.
- **PostgreSQL real**, en una base desechable en el puerto 5433 (`worksite-location-binding-integration.test.ts`):
  PG-01…PG-04 **ok, ejecutadas y no omitidas**. Cubren:
  - unicidad del vínculo activo;
  - CHECK;
  - carrera de consumo: un ganador y un 409;
  - decisión vencida o que no es AUTO: sin `TimeEntry`.
- **Migraciones:** `migrate deploy` aplica toda la cadena sobre una base vacía. `migrate diff` contra la base
  migrada solo muestra un `RenameIndex` previo de `PrometeoDocumentGrant`, ajeno a este cambio.
  `verify:prisma-contract:db`: sin deriva.
- **Suites completas:** `@semse/api test:unit` 4081 tests, 0 fallos; raíz 1753, 0 fallos; `lint` y `typecheck` OK;
  `spec:validate:strict` 0/0.

## No hecho / pendiente
- Clientes web y móvil (W-07): con el flag encendido, los inicios `proximity_auto` actuales reciben 409. Se
  adaptarán sobre la extracción FieldOps (#1169).
- La migración no se aplicó en staging ni en producción, y el flag no se activó en ningún entorno.
- Gate 5 en dispositivos: abierto.
