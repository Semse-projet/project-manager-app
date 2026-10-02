# C51 — clima por proyecto exige tenant + ProjectScope

Fecha: 2026-10-02 · Rama: `claude/c51-weather-scope` · Estado C51: **PARTIAL**.

## Hallazgo (revisión de falsos positivos de la guarda informativa, PR #749)
`GET /v1/projects/:projectId/weather/alerts` y `POST /v1/projects/:projectId/weather/check` recibían un `projectId` y llamaban al servicio **sin comprobar tenant ni organización**: cualquier CLIENT/PRO/WORKER autenticado podía leer las alertas de cualquier proyecto (incluso de otro tenant) y disparar consultas a Tomorrow.io (coste externo y escritura de alertas) sobre proyectos ajenos.

## Corrección
El controller resuelve el `ProjectScope` con el `ResourceScopeResolver` canónico **dentro del tenant del actor** y exige ser la org cliente, la org profesional asignada u OPS_ADMIN: otro tenant/inexistente ⇒ **404**, otra org del mismo tenant (u org vacía) ⇒ **403**. Segundo consumidor del resolver (migración gradual de la etapa 3).

## Pruebas
`apps/api/test/weather-scope.test.ts` (3): 404 cross-tenant (también OPS_ADMIN) y el servicio no se llama; 403 otra org / org vacía; 200 cliente, profesional y OPS_ADMIN. Suite API completa en verde, `typecheck` limpio, lint 0 errores.

## No cambiado a propósito (decisión pendiente)
`POST /v1/admin/weather/check` (procesa TODOS los proyectos activos de todos los tenants) exige hoy `weather:write`, que tienen CLIENT/PRO/OPS_ADMIN. El scheduler del worker lo llama con su identidad de servicio; restringirlo a OPS_ADMIN/SYSTEM requiere confirmar esa identidad para no romper el chequeo horario. Se reporta como hallazgo aparte.
