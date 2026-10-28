# Corrección de KIT-F3-02 (BFF ocultaba errores como 503) y KIT-F3-03 (texto traducido congelado en estado)

**Fecha:** 2026-10-21 · **Rama:** `claude/fix-bff-errores-i18n-estado` (desde `main` @ `06dfd7b`, independiente del kit) · **Origen:** hallazgos del spec ES/EN de la fase 3 del kit de calidad (PR #1022, `docs/semse-kit/test-matrix.md`) · **CI de GitHub:** bloqueado a nivel de cuenta; toda la evidencia es local.

## Resumen

**KIT-F3-02.** 10 rutas BFF con `fetch` propio respondían 503 "SEMSE server runtime is not configured" ante cualquier respuesta no-OK de la API, y sus `catch` sin argumento hacían lo mismo con una sesión ausente (401). Las rutas son 8 streams SSE (`sse/mission-control`, `sse/agents`, `sse/buildops`, `finance/stream`, `health/stream`, `cortex/context/stream`, `agents/delegations/stream`, `agents/plans/[planId]/stream`), el PDF de facturas y `my-bids`.
- Dos helpers nuevos en `apps/web/app/api/semse/_server.ts`:
  - `upstreamErrorResponse()` reenvía el estado y el mensaje reales de la API.
  - `routeErrorResponse()` sólo responde 503 si falta el runtime; una sesión ausente sigue siendo 401 y el resto, 502.
- Para los streams que responden OK sin cuerpo se devuelve 502, en lugar de 503.

**KIT-F3-03.** 30 sitios en 13 archivos guardaban en el estado de React texto ya traducido con `t(…)`, o lo lanzaban dentro de un `Error`, así que el mensaje no seguía un cambio de idioma posterior. El validador de la fase 3 sólo veía 12; un barrido con paréntesis balanceados encontró los demás: ternarios `e.message : t(…)`, `?? t(…)`, objetos `{ message: t(…) }`, plantillas y `throw new Error(t(…))`.
- Helper nuevo `apps/web/lib/ui-message.ts`. El estado guarda una clave (`messageKey`) o el texto del servidor (`messageText` / `messageTextOr`), y se traduce al pintar (`renderMessage`). `UiMessageError` y `messageFromError` conservan la clave a través de `throw`/`catch`.
- Archivos afectados:
  - páginas: `admin/dashboard`, `admin/mission-control`, `admin/contributors/submissions`, `worker/dashboard`, `client/dashboard`, `client/protools`, `client/marketplace` y 7 páginas de `buildops`;
  - componentes: `BuildOpsProjectHealthPanel` y `MilestoneGovernancePanel`.
- En 5 `useCallback`, `t` dejó de usarse y salió de las dependencias, como pide ESLint. Esas cargas ya no se repiten al cambiar de idioma, en línea con el objetivo de #970.

## Checklist final

- ✅ Ninguna ruta BFF convierte un error de la API ni una sesión ausente en "runtime not configured" (guarda estática en tests).
- ✅ Ningún setter de estado ni `throw new Error` lleva texto traducido (guarda estática en tests).
- ✅ Tests de comportamiento: helpers reales de `_server.ts` y ruta SSE con `fetch` simulado (403 → 403; sin sesión → 401).
- ✅ Verificado en vivo con stack local y web en modo producción.
- ✅ Sin cambios de API, permisos, esquema ni dependencias.
- ❌ KIT-F3-01 (falta de permiso en `@Sse("mission-control")`) **no** se corrige aquí: requiere decisión RBAC. Ahora se ve como el 403 real en lugar de 503.

## Evidencia

| Comando / prueba (desde `project-manager-app/`) | Resultado |
|---|---|
| `node --experimental-strip-types --test tests/unit/bff-upstream-errors.test.ts tests/unit/ui-message.test.ts` | 7 pass, 0 fail |
| `pnpm test:unit` (tras `pnpm build:api`) | 1577 tests: 1559 pass, 11 todo, 1 fail (`browser-governance: isUrlSafe`, que necesita DNS real; ya fallaba igual antes) |
| `pnpm --filter @semse/web exec tsc --noEmit -p tsconfig.json` | sin errores |
| `npx eslint` sobre los 28 archivos web cambiados | 0 errores, 0 avisos |
| curl, OPS_ADMIN sintético → `GET /api/semse/sse/mission-control` | **403** `{"error":{"status":403,"message":"RBAC metadata required"}}` (antes 503); sin sesión, **401** |
| Playwright, cliente sintético en `/client/protools`: error de validación en ES → cambio a EN | el mensaje pasa de "Describe el trabajo" a "Describe the job"; 0 restos en español |
| Spec ES/EN de la fase 3 contra este build | 4/4; anotación `known-defect-fixed?` en OPS_ADMIN (el SSE ya no es 5xx) |

## Siguientes pasos

1. CI verde cuando se restablezca GitHub Actions, revisión y merge.
2. En #1022, tras este merge: marcar KIT-F3-02 y KIT-F3-03 como corregidos en `test-matrix.md`, quitar la entrada de `KNOWN_BFF_FAILURES` (el 403 ya no es 5xx) y ampliar la regla `translated-text-in-state` del validador con las variantes que encontró este barrido.
3. KIT-F3-01: decidir el permiso del stream de Mission Control (`semse-rbac-permissions`, `semseproject`).
