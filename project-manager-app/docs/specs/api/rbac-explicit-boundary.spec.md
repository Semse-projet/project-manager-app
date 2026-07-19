---
id: "api.rbac-explicit-boundary"
title: "API Spec: RBAC Explicit Boundary"
domain: "core"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - apps/api/src/common/permissions.decorator.ts
  - apps/api/src/common/rbac.guard.ts
related_tests:
  - apps/api/test/rbac-explicit-boundary.test.ts
  - apps/api/test/domain-rbac-permissions.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-07-12"
---

# API Spec: RBAC Explicit Boundary

**Estado:** VERIFIED
**Fecha:** 2026-06-28
**Riesgo:** L2
**Servicios tocados:** api, auth
**Plan relacionado:** `docs/program/execution/SEMSE_ECOSYSTEM_IMPROVEMENT_MASTER_PLAN_2026-06-28.md`

## Problema

La API tenia handlers autenticados que no declaraban si eran publicos, protegidos por permiso granular o solo autenticados. Con un guard global, esa omision crea un bypass silencioso: cualquier endpoint sin metadata queda permitido si el usuario tiene sesion.

El contrato de seguridad debe fallar cerrado. La ausencia de metadata RBAC es un error de configuracion, no una autorizacion implicita.

## Contrato

Todo handler HTTP de controller debe cumplir una de estas reglas:

- `@Public()` cuando el endpoint acepta trafico sin sesion.
- `@RequirePermissions("...")` cuando el endpoint requiere permisos RBAC granulares.
- `@AuthenticatedAccess("reason")` cuando el endpoint es intencionalmente auth-only y todavia no tiene permiso granular propio.

`@AuthenticatedAccess` exige una razon no vacia. Su uso no sustituye controles de tenant, ownership o recurso; solo elimina la autorizacion implicita y deja deuda visible.

## Politica del guard

`RbacGuard` evalua en este orden:

1. `@Public()` permite la ruta.
2. `@RequirePermissions(...)` exige que todos los permisos declarados existan en los roles del actor.
3. `@AuthenticatedAccess(reason)` permite la ruta solo como acceso autenticado explicito.
4. Sin metadata, responde `403 Forbidden` con `policy: "deny_by_default"`.

## Clasificacion inicial

Permisos granulares aplicados:

- Upload plan y upload PUT: `evidence:write`.
- Evidence validation stream: `evidence:read`.
- Evidence legacy:
  - export bundle, preview, photo list/detail and daily log reads: `evidence:read`;
  - photo upload and daily log signature: `evidence:write`.
- Smart intake publish: `jobs:create`.
- Knowledge/anatomy/repo/runtime knowledge:
  - read/query/status: `knowledge:read`;
  - skill/curation writes: `knowledge:write`.
- Tools:
  - catalog/schema: `tools:read`;
  - calculators, quote builders, AI assist and derived outputs: `tools:run`.
- Vision:
  - result reads: `vision:read`;
  - analysis/transforms/batch/safety/material/space operations: `vision:run`.
- Weather:
  - alerts/history/matrix: `weather:read`;
  - manual check-now trigger: `weather:write`.
- Legacy project change orders:
  - list and timeline: `change-orders:read`;
  - create and submit: `change-orders:create`;
  - approve and reject: `change-orders:approve`.
- Developer runtime:
  - catalog, list, detail: `autonomy:runs:read`;
  - create/mission/approval/execute: `autonomy:runs:create`;
  - worker progress/start: `agents:run:worker`;
  - worker complete/fail: `agents:run:manage`.
- Lien scheduler admin: `ops:dashboard:write`.

Acceso autenticado explicito:

- Auth/session self endpoints.
- User/profile self endpoints.
- Smart intake claim con session token.
- Controladores legacy JWT-protected de draw requests, liens y lender webhook.

## Validacion ejecutable

- `apps/api/test/rbac-explicit-boundary.test.ts` audita todos los `*.controller.ts` y falla si un handler HTTP no publico no declara `@RequirePermissions`, `@AuthenticatedAccess` o `@Public`.
- `apps/api/test/domain-rbac-permissions.test.ts` valida que knowledge/tools/vision/weather usen permisos de dominio y no `@AuthenticatedAccess`.
- `apps/api/test/legacy-evidence-rbac-permissions.test.ts` valida que evidence legacy y project change-orders legacy usen permisos granulares y no `@AuthenticatedAccess`.
- El mismo test cubre que `RbacGuard` niega rutas autenticadas sin metadata explicita.
- Tests existentes refuerzan metadata concreta de uploads y evidence-gateway.

## Riesgos residuales

- Los controladores legacy marcados con `@AuthenticatedAccess` siguen pendientes de permisos granulares y ownership por recurso.
- La auditoria valida metadata de controllers; no prueba ABAC/tenant scoping de cada servicio.
- Los permisos nuevos no cambian los sets de roles; si un flujo requiere roles distintos, debe ajustarse en `packages/auth/src/rbac.ts` con test de contrato.

## Rollback

Revertir `RbacGuard`, `AuthenticatedAccess` y la metadata agregada a controllers. Si se revierte, mantener al menos la auditoria como reporte para no perder visibilidad del riesgo L2.
