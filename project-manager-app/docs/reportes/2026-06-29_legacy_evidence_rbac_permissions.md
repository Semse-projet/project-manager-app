# Reporte: Legacy Evidence RBAC Permissions

**Fecha:** 2026-06-29
**Estado:** IMPLEMENTADO EN RAMA
**Rama:** `fix/evidence-rbac-permissions`
**Riesgo:** L2
**Spec:** `docs/specs/api/rbac-explicit-boundary.spec.md`

## Que se hizo

- Se migraron fuera de `@AuthenticatedAccess` estos controladores legacy:
  - evidence export bundle;
  - evidence photo upload/list/detail;
  - evidence daily logs;
  - project-scoped legacy change orders.
- Se mapearon lecturas legacy de evidencia a `evidence:read`.
- Se mapearon mutaciones legacy de evidencia a `evidence:write`.
- Se mapearon change orders legacy al dominio existente:
  - list/timeline: `change-orders:read`;
  - create/submit: `change-orders:create`;
  - approve/reject: `change-orders:approve`.
- Se agrego `apps/api/test/legacy-evidence-rbac-permissions.test.ts` para evitar regresion a acceso autenticado generico.

## Decision tecnica

El corte usa permisos ya existentes en `packages/auth/src/rbac.ts`; no agrega nuevos permisos ni cambia roles. Esto preserva acceso de CLIENT, PRO y OPS_ADMIN donde ya existia contrato de evidencia/change-orders, y deja WORKER fuera de esta superficie legacy porque no tenia permisos de evidencia ni change-orders.

## Validacion

- `pnpm --filter @semse/api build` — OK.
- `node --experimental-strip-types --test apps/api/test/legacy-evidence-rbac-permissions.test.ts apps/api/test/rbac-explicit-boundary.test.ts apps/api/test/evidence.spec-contract.test.ts apps/api/test/change-orders.controller.test.ts tests/unit/auth.test.ts` — OK, 73 tests.
- `pnpm --filter @semse/api test:unit` — OK, 1649 tests.
- `pnpm test:unit` — OK, 58 tests.
- `git diff --check` — OK.
- `pnpm spec:preflight` — OK.

## Riesgos residuales

- Estos endpoints legacy aun contienen placeholders de identidad como `user-from-jwt`; la migracion de permisos no sustituye ownership/ABAC por recurso.
- Draw requests, liens y lender webhook siguen bajo `@AuthenticatedAccess` hasta un corte con permisos granulares y verificacion de recurso/firma.
