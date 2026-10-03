# C51 — `POST /v1/admin/weather/check` solo para la identidad interna del worker (2026-10-03)

## Hallazgo
`POST /v1/admin/weather/check` ejecuta `checkAllActiveProjectsWeather()`: consulta a Tomorrow.io y escribe `WeatherAlert`
para **todos los proyectos activos de todos los tenants**. Solo exigía `weather:write`, permiso que también tienen
CLIENT y PRO, así que cualquier usuario con ese permiso podía disparar una operación global (coste externo + escrituras).
Era el punto diferido en `2026-10-02_c51-weather-scope.md`.

## Evidencia aportada por el dueño (producción, solo lectura)
- `semse-worker` corre con roles `OPS_ADMIN,WORKER,EVENT_CONSUMER`.
- `WEATHER_CHECK_ENABLED` no está configurado: el scheduler está apagado, así que endurecer la ruta no afecta una ejecución activa.

## Cambio
- `weather.controller.ts`: se mantiene `@RequirePermissions('weather:write')` y se añade un fail-closed en el controller:
  exige `OPS_ADMIN` **y** `EVENT_CONSUMER` antes de llamar al servicio; si falta cualquiera ⇒ 403 (`requiredRoles`).
  Mismo patrón de identidad de servicio que `domain-events/:eventId/process`.
- No se toca `packages/auth/src/rbac.ts` (lo modifica #754; se evita el conflicto).
- No se activa `WEATHER_CHECK_ENABLED`. Sin migración, sin flags, sin CI, sin Railway.

## Pruebas (`weather-admin-check.test.ts`)
CLIENT / PRO / WORKER / sin roles ⇒ 403; OPS_ADMIN humano sin EVENT_CONSUMER ⇒ 403; EVENT_CONSUMER sin OPS_ADMIN ⇒ 403
(el servicio no se llama en ninguno); OPS_ADMIN + EVENT_CONSUMER ⇒ 200 y servicio llamado una vez por petición.
Comprobado con mutación: sin el fail-closed fallan 2 de los 4 tests.

## Pendiente / límites
- Antes de activar `WEATHER_CHECK_ENABLED` hay que confirmar que el login del worker emite exactamente esos roles (el
  worker se autentica con `postJson`/`authState`); la activación sigue siendo decisión del dueño.
- C51 sigue **PARTIAL**: no hay smoke autenticado multi-tenant/multi-org en producción.
