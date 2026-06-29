# Reporte: Domain RBAC Permissions

**Fecha:** 2026-06-29
**Estado:** IMPLEMENTADO EN RAMA
**Rama:** `fix/domain-rbac-permissions`
**Riesgo:** L2
**Spec:** `docs/specs/api/rbac-explicit-boundary.spec.md`

## Que se hizo

- Se agregaron permisos de dominio al registry RBAC:
  - `knowledge:read`, `knowledge:write`;
  - `tools:read`, `tools:run`;
  - `vision:read`, `vision:run`;
  - `weather:read`, `weather:write`.
- Se migraron fuera de `@AuthenticatedAccess`:
  - anatomy, repo-knowledge, runtime-knowledge y knowledge;
  - tools;
  - vision;
  - weather.
- Se separaron permisos read/run/write donde habia diferencia clara:
  - tools GET usa `tools:read`, POST usa `tools:run`;
  - vision GET usa `vision:read`, POST usa `vision:run`;
  - weather GET usa `weather:read`, check manual usa `weather:write`;
  - knowledge graph usa `knowledge:read`, skill/curation write usa `knowledge:write`.

## Decision tecnica

Este corte evita tocar controladores legacy de pagos/evidencia/liens porque ahi el riesgo real no es solo el nombre del permiso: falta ownership por recurso y eliminacion de placeholders de identidad. En esos modulos se mantiene `@AuthenticatedAccess` hasta que el cierre incluya ABAC/tenant scoping por servicio.

## Validacion final

- `pnpm --filter @semse/api build` — OK.
- `node --experimental-strip-types --test apps/api/test/domain-rbac-permissions.test.ts apps/api/test/rbac-explicit-boundary.test.ts tests/unit/auth.test.ts` — OK, 37 tests.
- `pnpm --filter @semse/api test:unit` — OK, 1645 tests.
- `pnpm test:unit` — OK, 58 tests.
- `git diff --check` — OK.
- `pnpm spec:preflight` — OK.

## Riesgos residuales

- `knowledge:write` queda habilitado para CLIENT y OPS_ADMIN para preservar flujos previos autenticados; si producto decide restringirlo a admins, debe hacerse con prueba negativa y migracion UI/BFF.
- `weather:write` queda habilitado para CLIENT, PRO y OPS_ADMIN; WORKER solo lee clima.
- Legacy escrow/evidence/liens y lender webhook siguen pendientes de permisos granulares mas ownership.
