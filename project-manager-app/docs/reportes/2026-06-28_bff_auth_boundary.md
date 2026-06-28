# Reporte: BFF Auth Boundary

**Fecha:** 2026-06-28
**Rama:** `specs/f0-security-readiness`
**Estado final:** IMPLEMENTADO EN RAMA
**Riesgo:** high

## Qué se hizo

- Se cerró el acceso anónimo por defecto a rutas privadas `/api/semse/*` en el middleware web.
- Se agregó una allowlist explícita para rutas SEMSE API públicas:
  - auth login/register/reset/forgot/token;
  - `healthz`;
  - `stats/public`;
  - `/api/semse/public/*`.
- Se agregó política pura testeable en `apps/web/lib/semse-api-auth.ts`.
- Se agregó spec formal `api-bff-auth-boundary`.
- Se actualizó `docs/SPEC_INDEX.md`.
- Se agregó test unitario para la clasificación de rutas públicas/privadas.

## Archivos modificados

- `apps/web/middleware.ts` — aplica 401 JSON antes de ejecutar handlers privados sin sesión.
- `apps/web/lib/semse-api-auth.ts` — centraliza allowlist y body de error.
- `tests/unit/web-bff-auth-policy.test.ts` — cubre rutas públicas, privadas y error 401.
- `docs/specs/api/bff-auth-boundary.spec.md` — contrato SDD del boundary.
- `docs/SPEC_INDEX.md` — registra el nuevo spec.

## Validación

- `node --experimental-strip-types --test tests/unit/web-bff-auth-policy.test.ts` pasó.
- `node --experimental-strip-types --test tests/unit/web-bff-auth-policy.test.ts tests/unit/web-session.test.ts` pasó.
- `pnpm --filter @semse/web exec tsc -p tsconfig.json --noEmit` pasó.
- `git diff --check` pasó.

## Validaciones con bloqueo externo al cambio

- `pnpm test:unit` ejecutó el nuevo test y lo pasó, pero el comando completo falló porque varias pruebas legacy importan `apps/api/dist/...` sin haber corrido build API primero.
- `pnpm --filter @semse/web lint` falló antes de lintar por dependencia local faltante: `@eslint/eslintrc` importada desde `apps/web/eslint.config.mjs`.
- `pnpm --filter @semse/web build` compiló Next correctamente y llegó a `Collecting page data`; se interrumpió manualmente después de varios minutos sin cierre final.
- `node scripts/spec-validate.mjs` falla por deuda previa:
  - referencias a `tests/unit/payment-escrow-status-prisma.test.ts` que no existe;
  - `m3.1-multi-stage-releases.spec.md` con metadata incompleta y status legacy `READY`.
- `node scripts/spec-coverage.mjs --fail-on-gaps` falla por specs legacy de tools sin metadata canónica.

## Investigación externa de mejora

### Fuentes consultadas

1. OWASP API Security 2023 — Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
2. Next.js Proxy/Middleware matcher docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

### Ideas detectadas

- El control debe ocurrir antes del handler cuando la ruta puede tocar objetos privados.
- La clasificación de rutas debe ser explícita y testeable; los wildcards amplios como `/api/*` son demasiado permisivos.

### Decisiones

- Aplicado ahora: `/api/semse/*` privado por defecto con allowlist pública explícita.
- Backlog: migrar rutas legacy con `fetchSemseData()` a `fetchSemseDataForRequest(req)` para evitar identidad estática incluso en requests autenticados.
- Descartado ahora: cambiar backend RBAC/AuthGuard en este PR; ese es otro bloque P0.

## Riesgos residuales

- Varias rutas privadas todavía usan `fetchSemseData()` sin request. El acceso anónimo queda bloqueado por middleware, pero el próximo bloque debe migrarlas para usar identidad real por sesión.
- La allowlist pública debe revisarse cada vez que se agregue una nueva ruta pública.
- Las rutas SSE privadas ahora exigen sesión; páginas protegidas deben llamar con cookies normales del navegador.

## Próximo bloque recomendado

`F0-BFF-REQUEST-IDENTITY`: migrar las rutas legacy listadas por auditoría de `fetchSemseData()` a helpers por-request y añadir un test que falle si una ruta privada nueva usa identidad estática.
