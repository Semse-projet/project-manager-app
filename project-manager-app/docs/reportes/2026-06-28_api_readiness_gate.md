# Reporte: API Readiness Gate

**Fecha:** 2026-06-28
**Estado:** IMPLEMENTADO EN RAMA
**Rama:** `fix/api-readiness-gate`
**Riesgo:** L2
**Spec:** `docs/specs/api/readiness.spec.md`

## Qué se hizo

- Se agregó `GET /v1/ready` como readiness público separado de `GET /v1/health`.
- `/v1/health` conserva comportamiento de liveness: proceso HTTP vivo, sin bloquear por dependencias degradadas.
- `/v1/ready` devuelve `200` solo si están listas las dependencias requeridas:
  - DB vía Prisma `SELECT 1`;
  - migraciones Prisma sin filas fallidas o incompletas;
  - Redis/queues en estado `ok`;
  - storage local con root escribible.
- Worker queda como señal advisory por defecto para no bloquear deploy de API cuando vive en otro servicio Railway.
- `SEMSE_READY_REQUIRE_WORKER=true` permite exigir heartbeat worker si el gate de entorno lo requiere.
- Se agregó health check explícito a `StorageService`.
- Se separó la lógica pura de readiness de Nest para pruebas unitarias sin compilar toda la app.

## Decisión técnica

La auditoría inicial de RBAC encontró 125 handlers autenticados sin `@RequirePermissions`. Activar deny-by-default global en el mismo PR rompería módulos no clasificados. Ese bloque debe cerrarse en un PR dedicado con registry, clasificación de endpoints y pruebas negativas por controlador.

## Validación

- `node --experimental-strip-types --test tests/unit/api-readiness.test.ts` — OK, 4 tests.
- `pnpm --filter @semse/api build` — OK.
- `pnpm test:unit` — OK, 58 tests.
- `pnpm --filter @semse/api test:unit` — OK, 1637 tests.
- `git diff --check` — OK.
- `pnpm spec:preflight` — OK.

## Riesgos residuales

- El endpoint detecta migraciones fallidas o incompletas en `_prisma_migrations`; no compara archivos de migración locales contra DB en runtime.
- Storage no-local (`s3`/`r2`) falla readiness hasta que exista implementación real.
- Redis es requerido para readiness; en entornos locales sin Redis, `/v1/ready` debe responder `503` mientras `/v1/health` sigue respondiendo `200`.

## Rollback

- Volver el healthcheck operacional a `/v1/health` si hay incidente externo con dependencias sanas pero readiness bloquea deploy.
- Revertir `ReadinessService`, `readiness.logic.ts`, `GET /v1/ready` y `StorageService.healthCheck()` si el endpoint introduce regresión de arranque.
