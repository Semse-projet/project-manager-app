# 2026-11-18 — Guard de Passport sin estrategia en capability-registry y weather

## Problema
`GET /v1/capabilities`, `GET /v1/projects/:projectId/weather/alerts` y `POST /v1/admin/weather/check` respondían
**500** en cualquier entorno: `Unknown authentication strategy "jwt"`.

## Causa raíz (demostrada)
Los dos controladores declaraban `@UseGuards(AuthGuard('jwt'))` de `@nestjs/passport`, pero la API no registra
ninguna `PassportStrategy`. Es el mismo defecto que se encontró en liens (#1150). La autenticación real es el
`APP_GUARD` global (`common/auth.guard.ts`); la autorización la aplican `RbacGuard` con
`@AuthenticatedAccess`/`@RequirePermissions` y las reglas propias de cada controlador.

## Solución
Se quita el guard de Passport de los dos controladores. No cambia ninguna política de acceso.

## Pruebas
- Reproducción en vivo (Postgres + API construida desde `main`): los 3 endpoints daban 500.
- Test de regresión `apps/api/test/passport-guard-regression.test.ts`: falla antes del cambio (0/2) y pasa después.
- Tests existentes de capability-registry y weather: 45/45.
- En vivo después del cambio:
  - capabilities: 200 para cualquier autenticado; 401 sin identidad.
  - weather alerts: 200 para el PRO del proyecto; 401 sin identidad.
  - `admin/weather/check`: 403 para WORKER y también para OPS_ADMIN sin `EVENT_CONSUMER`. Es la regla intencional del
    controlador: exige la identidad de servicio del worker.
  - Ningún «Unknown authentication strategy» en el log.

## Riesgo y rollback
El riesgo es bajo porque la autenticación global ya cubría estas rutas. Para revertir, basta con revertir el commit.
Sin migraciones ni flags.
