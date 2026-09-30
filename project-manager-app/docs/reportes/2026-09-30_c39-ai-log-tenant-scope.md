# Reporte — C39 Router de modelos: observabilidad tenant-safe (Wave A, lote A1, parte 1)

**Fecha:** 2026-09-30 · **Base:** main `21ccbeb`

## Estado
- Previo: PARCIAL. Criterio: "ruta observable por tarea, modelo, costo, permiso y resultado".
- Actual: **PARCIAL (avance)** — tarea/modelo/resultado ya se registraban; se cierra el hueco de **tenant/permiso de lectura**. Costo sigue abierto.

## Hallazgos (verificados en código)
1. `GET /v1/agents/logs`, `/logs/stats`, `/logs/db` devolvían logs de **todos los tenants** a cualquier actor con `agents:run:create` (cross-tenant read; C10).
2. `POST /v1/agents/generate` tomaba `userId` y `metadata.tenantId` del body → `AiInteractionLog.tenantId` falsificable/nulo, log de auditoría manipulable.

## Cambios
- `logging/ai-interaction-logger.service.ts`: lecturas (`getRecentLogs`, `getDbLogs`, `getStats`) exigen `tenantId` y filtran en cada query; buffer guarda `tenantId`; filas legacy sin tenant no se devuelven (fail-closed).
- `ai-models.controller.ts`: `generate` estampa `userId`/`tenantId`/`orgId` del actor autenticado (ignora los del body); los 3 endpoints de logs pasan `actor.tenantId`.
- Migraciones: ninguna.

## Tests
- Nuevo `test/ai-interaction-logger-tenant.test.ts` (3); ajustado `ai-interaction-logger.service.test.ts` a la nueva firma.
- API unit: 2547 tests, 2510 pass, 0 fail; `tsc --noEmit`, `pnpm lint`, `nest build` OK.

## Abierto en C39
- **Costo**: `estimatedCostUsd` nunca se calcula (los providers no lo devuelven). Requiere tabla de precios aprobada por producto; no se inventan tarifas.
- **Permiso/actor**: sólo `userId`; registrar roles/decisión de policy requiere columna nueva (migración aditiva) → siguiente parte.
- Cambio de comportamiento: el `userId` del body de `/generate` ya no se respeta (siempre el del actor).
