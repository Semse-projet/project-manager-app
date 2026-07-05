# API Spec: Readiness

**Estado:** VERIFIED
**Fecha:** 2026-06-28
**Riesgo:** L2
**Servicios tocados:** api, db, redis, storage, railway
**Plan relacionado:** `docs/program/execution/SEMSE_ECOSYSTEM_IMPROVEMENT_MASTER_PLAN_2026-06-28.md`

## Problema

`/v1/health` confirma que el proceso HTTP responde, pero no demuestra que la API pueda operar con dependencias reales. Railway y los gates de producción necesitan una señal separada que falle cerrada cuando DB, Redis/queues, storage o migraciones no estén listos.

## Contrato

### `GET /v1/health`

Liveness público. Debe responder `200` si el proceso API está vivo, aunque una dependencia esté degradada.

### `GET /v1/ready`

Readiness público para health gates. Debe responder:

- `200` cuando todas las dependencias requeridas están `ok`.
- `503` cuando falla una dependencia requerida.

Respuesta:

```json
{
  "data": {
    "status": "ready",
    "checkedAt": "2026-06-28T00:00:00.000Z",
    "components": [
      { "name": "database", "state": "ok", "required": true, "latencyMs": 12, "detail": "Prisma query succeeded" },
      { "name": "migrations", "state": "ok", "required": true, "latencyMs": 8, "detail": "No failed or incomplete Prisma migrations" },
      { "name": "redis", "state": "ok", "required": true, "latencyMs": 3, "detail": "Redis is ok" },
      { "name": "worker", "state": "degraded", "required": false, "latencyMs": 3, "detail": "Worker heartbeat is degraded; advisory for API readiness" },
      { "name": "storage", "state": "ok", "required": true, "latencyMs": 2, "detail": "Local storage root is writable (local:/tmp/semse-storage)" }
    ]
  }
}
```

## Dependencias requeridas

- `database`: `DATABASE_URL` configurado y `SELECT 1` exitoso vía Prisma.
- `migrations`: tabla `_prisma_migrations` sin filas fallidas o incompletas.
- `redis`: ping/estado Redis `ok` vía `HealthService`.
- `storage`: provider local con root escribible.

`worker` es advisory por defecto para no bloquear el deploy de API cuando el worker vive en otro servicio Railway. Puede volverse requerido con `SEMSE_READY_REQUIRE_WORKER=true`.

## Validación

- Unit: `tests/unit/api-readiness.test.ts`
- API/build: `pnpm --filter @semse/api build`
- Gate recomendado: Railway debe usar `/v1/ready` para readiness y conservar `/v1/health` como liveness.

## Rollback

Volver el healthcheck de Railway a `/v1/health` si un incidente de infraestructura impide conectar dependencias sanas, dejando un reporte en `docs/reportes/`.
