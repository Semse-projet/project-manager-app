# Worker: los fallos de los barridos ya registran el motivo

**Fecha:** 2026-11-11 · **Rama:** `fix/worker-error-logging`

## Problema

`logger.warn({ error }, "...")` con pino serializa un `Error` en una clave que no es `err` como `{}`. En producción, el worker registraba "stale reclaim call failed", "reservation sweep failed" y "contributor extraction sweep failed" cada 10–60 s **sin motivo**. Por eso, el 403 de `/v1/agents/runs/reclaim-stale` causado por la falta del rol `AGENT_RUNNER` tras #1129 solo se pudo diagnosticar cruzándolo con los logs HTTP de la API (Railway, solo lectura, 2026-11-10).

## Cambio

- `apps/worker/src/observability/job-logging.mjs`: `describeError(error)` devuelve un objeto plano con `message` (recortado a 500 caracteres), `type`, `httpStatus` y `path` cuando el mensaje sigue el formato de `requestJson` (`HTTP <status> <path>: …`), y `causeCode` en los errores de red. No incluye stack ni cuerpo.
- `apps/worker/src/main.mjs`: los 6 `logger.*({ error })` (reclaim, barrido de reservas, live sessions, contributors y los dos del consumidor de eventos) usan `describeError`.

No cambia el comportamiento: solo el contenido de los logs.

## Verificación

- `tests/unit/worker-error-logging.test.mjs`: 3/3.
- `node --check apps/worker/src/main.mjs`.
