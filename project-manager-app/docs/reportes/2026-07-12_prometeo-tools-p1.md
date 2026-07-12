# Reporte — Prometeo Tools P1

Fecha: 2026-07-12

## Objetivo

Pasar el Tool Registry de Prometeo de catálogo declarativo a ejecución controlada
de herramientas de lectura, sin habilitar mutaciones desde el asistente.

## Cambios implementados

- Se agregó `PrometeoToolInvokeInput` en
  `packages/schemas/src/prometeo-runtime.schema.ts`.
- Se añadió `POST /v1/prometeo/tools/invoke`.
- Se agregaron proxies BFF web para `GET /api/semse/prometeo/tools` y
  `POST /api/semse/prometeo/tools/invoke`.
- `apps/web/app/semse-api.ts` expone `fetchPrometeoToolRegistry()` e
  `invokePrometeoTool()`.
- Se creó `PrometeoToolExecutionService` con adapters de lectura para:
  - Time Tracker.
  - SEMSE Agro.
  - Vision con análisis ya persistidos.
- El endpoint rechaza tools no registradas y cualquier tool `write` o `critical`.
- `vision.analyze_video` queda bloqueada en runtime hasta existir pipeline temporal
  real de video intelligence.
- El registry se amplió con lecturas de Vision, Agro farms, grupos, inventario y
  costos.
- `PrometeoModule` importa `FieldOpsModule`, `AgroModule` y `VisionModule` para
  usar servicios existentes en lugar de duplicar lógica.
- `POST /v1/ai-models/prometeo/chat` ejecuta requested actions read-only
  explícitas mediante el mismo servicio y devuelve `executionResults`.
- El chat acepta `requestedActionInput` y el BFF web lo transporta al runtime.
- Las respuestas del chat agregan el bloque `tool_execution_results` cuando una
  tool corre, falla o queda bloqueada.

## Límites explícitos

- P1 no ejecuta mutaciones.
- P1 no ejecuta análisis visuales nuevos desde el endpoint genérico; solo consulta
  resultados persistidos.
- El chat operativo ejecuta solo tools de lectura registradas; las mutaciones se
  mantienen como `proposedActions` con aprobación.

## Verificación

Pasó:

```bash
pnpm --filter @semse/schemas build
node --experimental-strip-types --test apps/api/test/ai-models.controller.test.ts apps/api/test/prometeo.controller.test.ts
pnpm --filter @semse/api build
pnpm --filter @semse/web build
```
