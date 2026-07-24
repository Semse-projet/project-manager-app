# Aislamiento de rutas huérfanas — 2026-07-24

## Alcance

Se cerraron los hallazgos `1.6`, `1.7` y `2.7` de
`docs/AUDIT_REMEDIATION_PLAN.md`:

- `/dashboard` exponía una implementación sin navegación canónica, KPIs en cero,
  un banner interno de migración y una lectura server-side con identidad estática
  de entorno;
- `/field-ops` mantenía una tercera implementación de 929 líneas, sin navegación
  y divergente de las superficies soportadas.

## Implementación

- Se eliminó `apps/web/app/dashboard/dashboard-client.tsx`.
- `/dashboard` quedó como alias protegido hacia:
  - CLIENT → `/client/dashboard`;
  - WORKER/PRO → `/worker/dashboard`;
  - OPS_ADMIN → `/admin/dashboard`.
- Se eliminó la implementación top-level duplicada de Field Ops.
- `/field-ops` quedó como alias protegido hacia:
  - WORKER/PRO → `/worker/field-ops`;
  - OPS_ADMIN → `/admin/field-ops`;
  - CLIENT → `/client/dashboard`.
- El matching de ambos aliases es exacto; no captura paths como
  `/dashboard/stats` o `/field-ops-old`.
- Las páginas residuales redirigen a login si llegan a ejecutarse sin pasar por
  middleware. El middleware conserva los query params al enviar una sesión
  válida a su ruta canónica.

El middleware es defensa de navegación y no la única barrera: retirar las
implementaciones huérfanas y dejar páginas fail-closed evita que vuelvan a
renderizar datos aunque esa capa sea omitida.

## Verificación

- `node --experimental-strip-types --test tests/unit/legacy-route-redirect.test.ts tests/unit/client-money-confirmation.test.ts`
  — 9/9.
- `node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`
  — typecheck limpio.
- `node scripts/spec-validate.mjs --strict`
  — 104 specs, 0 errores y 0 warnings.
- `node scripts/audit-plan-spec-coverage.mjs`
  — 157/157 items mapeados, 0 faltantes y 0 extras.
- `corepack pnpm --filter @semse/web lint`
  — 0 errores; 54 warnings preexistentes.
- `corepack pnpm --filter @semse/web build`
  — compilación y typecheck correctos; 402 páginas generadas.

## Estado operativo

No se hizo push ni deploy. La verificación local cubre la matriz de roles y el
fail-closed; falta una pasada manual con sesiones reales después del despliegue.
