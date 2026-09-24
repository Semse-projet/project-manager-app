# Reporte — Cliente Jev AI (`jev-ai.pro`)

- **Fecha:** 2026-09-24
- **Rama:** `claude/google-docs-link-f39dr2` (reiniciada desde `main@9ac2924` tras el merge de #670)
- **Spec:** `docs/specs/prometeo/jev-decision-layer.spec.md` v1.3 §9.9 (tareas T-030…T-035)

## Qué cambia

- Nuevo `apps/api/src/modules/ai-models/decision/jev-ai.client.ts` (`JevAiClient`):
  - `POST https://jev-ai.pro/api/v1/systemone` y `GET /api/v1/models`, con `Authorization: Bearer $JEV_AI_API_KEY`.
  - Respuestas tipadas: `noul`, `choice` y `score`, más `usage`.
  - Errores tipados: 401, 402, 422, 429 (con `Retry-After`), 502, 504, 5xx, timeout, red, sin key e input demasiado largo.
  - Pre-chequeo de los límites de Laya.
- `JevHttpProvider` usa el cliente. La capa de decisión, sus flags, las invariantes y el fallback no cambian.
- Variables renombradas: `JEV_*` → `JEV_AI_*` (`JEV_AI_API_KEY`, `JEV_AI_BASE_URL`, `JEV_AI_MODEL`, `JEV_AI_TIMEOUT_MS`). No hay alias de compatibilidad: las variables `JEV_*` apuntaban a `api.typesafe.ai` y nunca se configuraron con una key válida.
- CLI nuevo: `pnpm --filter @semse/api jev:models` / `jev:call`. Lee `apps/api/.env` y nunca imprime la key.

## Política de reintentos

- Un POST con resultado incierto (timeout, error de red o 5xx) no se reintenta nunca.
- Un 429 bloquea las llamadas localmente hasta que vence `Retry-After`. Solo hay un reintento si el llamador lo pide explícitamente, y la capa de decisión no lo pide.

## Verificación

- `node --test` sobre `jev-ai-client.test.ts` más los 5 archivos Jev existentes: 63/63 en verde.
- `pnpm --filter @semse/api lint` y `tsc` limpios.
- `jev:eval --mock baseline` sin cambios.

## Pendiente / supuestos

- **T-035:** la llamada en vivo requiere que el dueño configure `JEV_AI_API_KEY`. Además, `jev-ai.pro` está bloqueado por la política de red del entorno de desarrollo.
- Supuestos no verificados contra la documentación: la forma del cuerpo de error, la forma de `/v1/models` y los campos de `score`. El parser acepta las variantes comunes y rechaza el resto.
- No se tocaron Railway ni variables de producción.
