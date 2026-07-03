# Reporte: RBAC Explicit Auth Boundary

**Fecha:** 2026-06-28
**Estado:** IMPLEMENTADO EN RAMA
**Rama:** `fix/rbac-explicit-auth-boundary`
**Riesgo:** L2
**Spec:** `docs/specs/api/rbac-explicit-boundary.spec.md`

## Que se hizo

- Se agrego `@AuthenticatedAccess(reason)` como metadata explicita para endpoints auth-only.
- `RbacGuard` ahora falla cerrado cuando una ruta no publica no declara `@RequirePermissions` ni `@AuthenticatedAccess`.
- La auditoria inicial paso de 125 handlers sin metadata explicita a 0.
- Se aplicaron permisos granulares donde ya existia intencion clara:
  - uploads: `evidence:write`;
  - evidence stream: `evidence:read`;
  - smart-intake publish: `jobs:create`;
  - developer-runtime: `autonomy:runs:*` y `agents:run:*`;
  - lien scheduler: `ops:dashboard:write`.
- Se marco deuda controlada con `@AuthenticatedAccess` en superficies self-scoped y legacy que aun requieren permisos por dominio/recurso.

## Decision tecnica

No se inventaron permisos nuevos en este PR. Donde no habia contrato de dominio estable, se uso metadata auth-only con razon explicita para evitar un cambio de producto silencioso. El resultado elimina el bypass por omision y deja una lista auditable para endurecimiento posterior.

## Validacion

- `pnpm --filter @semse/api build` — OK.
- `node --experimental-strip-types --test apps/api/test/rbac-explicit-boundary.test.ts apps/api/test/uploads.controller.test.ts apps/api/test/evidence-gateway.controller.test.ts` — OK, 12 tests.
- `pnpm --filter @semse/api test:unit` — OK, 1640 tests.
- `pnpm test:unit` — OK, 58 tests.
- `git diff --check` — OK.
- `pnpm spec:preflight` — OK.

## Riesgos residuales

- `@AuthenticatedAccess` todavia permite acceso a usuarios autenticados; los modulos legacy necesitan permisos granulares y controles de ownership por recurso.
- Lender webhook sigue requiriendo auth de plataforma mas firma del lender; hacerlo realmente publico debe ser un cambio separado con pruebas de firma negativas.
- La auditoria cubre metadata de controller, no autorizacion dentro de servicios.

## Siguiente cierre recomendado

Crear permisos granulares para knowledge/tools/vision/liens/weather/legacy escrow y migrar cada grupo fuera de `@AuthenticatedAccess` con pruebas negativas por rol.
