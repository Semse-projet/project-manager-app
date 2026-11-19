# Worker: los fallos de los barridos ya registran el motivo

**Fecha:** 2026-11-11 · **Rama:** `fix/worker-error-logging`

## Problema

`logger.warn({ error }, "...")` con pino serializa un `Error` en una clave que no es `err` como `{}`. En producción, el worker registraba "stale reclaim call failed", "reservation sweep failed" y "contributor extraction sweep failed" cada 10–60 s **sin motivo**. Por eso, el 403 de `/v1/agents/runs/reclaim-stale` causado por la falta del rol `AGENT_RUNNER` tras #1129 solo se pudo diagnosticar cruzándolo con los logs HTTP de la API (Railway, solo lectura, 2026-11-10).

## Cambio

- `apps/worker/src/observability/job-logging.mjs`: `describeError(error)` devuelve un objeto plano con `message` sanitizado, `type`, `httpStatus` y `path` sin query/fragmento cuando el mensaje sigue el formato de `requestJson` (`HTTP <status> <path>: …`), y únicamente `causeCode` de red con formato permitido. **El cuerpo de respuesta HTTP y los mensajes no reconocidos se omiten**, para no introducir tokens ni datos personales en los logs. Tampoco incluye stack ni cuerpo de la petición.
- `apps/worker/src/main.mjs`: los 6 `logger.*({ error })` (reclaim, barrido de reservas, live sessions, contributors y los dos del consumidor de eventos) usan `describeError`.

Se sanea también la salida `processJobWithLogging` de BullMQ. No cambian las transiciones de jobs ni la política de reintentos: solo el contenido de los logs.

## Verificación

- `tests/unit/worker-error-logging.test.mjs`: 5 casos escritos (sanitización de cuerpo, query strings, errores de red, valores no Error y rutas inesperadas); deben ejecutarse en CI después de este commit.
- `node --check apps/worker/src/main.mjs`.
