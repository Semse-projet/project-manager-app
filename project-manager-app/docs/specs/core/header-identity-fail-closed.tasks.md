---
type: tasks
feature: "Identidad por cabeceras sólo con opt-in explícito"
domain: "core"
plan: "docs/specs/core/header-identity-fail-closed.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "docs/core-header-identity-fail-closed"
date: "2026-11-04"
---

# Tareas: Identidad por cabeceras sólo con opt-in explícito

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado
- [x] [T-002] Registrar SHA (`origin/main` `be748bb`); sin migraciones ni flags
- [x] [T-003] Plan y checklist
- [x] [T-004] Investigación externa y decisión §13 registradas

## Fase 1 — Tests rojos

- [x] [T-010] `header-identity-policy.test.ts`: matriz `headerIdentityAllowed`
  y 503 en `resolveRequestContext` / `authenticateRequest` (AC-HI-01 a 05, 10)
- [x] [T-011] [P] `operational-intelligence-http-tenant.test.ts`: HTTP real,
  bearer del tenant A con cabecera de B (AC-HI-06 a 08)
- [x] [T-012] [P] Corregir `operational-intelligence.controller.test.ts`
  (contexto verificado, AC-HI-09)
- [x] [T-013] Guardia estática de `parseHeaderRequestContext` (AC-HI-11)
- [x] [T-014] Confirmar que T-010 a T-013 fallan contra el código actual

## Fase 2 — Implementación

- [x] [T-020] `headerIdentityAllowed` + uso en `resolveRequestContext`
- [x] [T-021] `authenticateRequest` usa la regla única
- [x] [T-022] OI controller: `resolveRequestContext(req)` en 7 handlers
- [x] [T-023] Log `auth_header_identity_mode_enabled` al arranque en `main.ts`
- [x] [T-024] `docs/auth.md`, `.env.example` y `apps/api/.env.example`

## Fase 3 — Verificación local

- [x] [T-030] Tests dirigidos verdes
- [x] [T-031] Suite unit API y suite de integración (Postgres desechable)
- [x] [T-032] Build API y typecheck
- [x] [T-033] Mutación: cada condición de la regla es necesaria
- [x] [T-034] `pnpm spec:validate:strict` y `pnpm spec:index`
- [x] [T-035] Spec: `code_status: COMPLETE`

## Fase 4 — PR y CI (este PR en borrador)

- [x] [T-040] Revisar diff y secretos
- [x] [T-041] Actualizar PR #1092 con evidencia
- [x] [T-042] CI terminal y `ci_status`
- [x] [T-043] Merge aprobado por el owner; squash 7a66a96 (2026-11-04)

## Fase 5 — Deploy y activación

- [~] [T-050] Deploy y smoke autenticado de OI: fuera de esta autorización

## Criterio de Done (de esta autorización)

- [ ] Código completo y tests verdes
- [ ] CI `PASS` en el PR en borrador
- [ ] Merge, deploy y activación: pendientes de aprobación del owner
