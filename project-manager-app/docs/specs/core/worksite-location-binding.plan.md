# Plan — OPEN-18 worksite-location-binding (servidor)

Spec: `docs/specs/core/worksite-location-binding.spec.md` (APPROVED 2026-11-20).

- **Base:** `main`. Independiente de #1054/#1169: no toca `crews.service.ts` ni `crews.controller.ts`; el código
  nuevo va en archivos propios para no chocar con esas ramas.
- **Datos:** migración aditiva y nulable `20261120120000_worksite_location_binding`:
  - columnas de ubicación en `Worksite`;
  - tabla `WorksiteBinding`;
  - `bindingId` y `consumedByTimeEntryId` en `GeofenceEvent`;
  - unicidad del vínculo activo con `activeTargetKey` (§7, v0.2) y CHECK en SQL.
  - `TimeEntry` no cambia.
- **Regla única de sitio:** `geofence/site-binding.ts` (`resolveSiteForWorker`), usada por la evaluación de eventos,
  la lista de sitios y el consumo de la decisión. Siempre revalida desde la base: vínculo ACTIVE, obra ACTIVE,
  WORKER ACTIVE y Job asignado o proyecto libre propio.
- **Gestión** (módulo de organizaciones, dueño de las obras): `WorksiteLocationService` y su controlador; requiere
  `org:crews:manage`, ResourceScope `read` para Jobs y ser creador para los proyectos libres.
- **Geocerca:** `site` opcional en `POST /v1/me/geofence-events`; obra no verificada → nunca AUTO
  (`siteVerified` en la política pura); `GET /v1/me/geofence-sites`.
- **Labor Engine:** con el flag encendido, `proximity_auto` exige `geofenceEventId`. Se valida en el servicio
  (vigencia, vínculo, objetivo y re-resolución) y se consume en el repositorio con una reclamación condicional,
  dentro de la misma transacción que crea el `TimeEntry`.
- **Flags:** `SEMSE_WORKSITE_BINDING_ENABLED` (nuevo, apagado), junto con `SEMSE_CREWS_ENABLED` y
  `SEMSE_GEOFENCE_POLICY_ENABLED`. Con el flag apagado, el contrato anterior no cambia (AC-01).
- **Rollback:** spec §10. Apagar el flag es inmediato; revertir el código no exige revertir la migración.
- **No cerrado** hasta adaptar los clientes (W-07), probar en staging aislado y completar el Gate 5 en el Motorola y
  ambos iPhone.
