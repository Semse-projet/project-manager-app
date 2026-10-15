---
type: tasks
feature: "Labor Engine — guard de ownership y destino en mutaciones de FreeProject (S0)"
domain: "labor"
plan: "docs/specs/labor/free-project-mutation-guard.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "spec/labor-s0-free-project-guard-20261015"
date: "2026-10-15"
---

# Tareas: guard de ownership y destino en mutaciones de FreeProject (S0)

> Prerrequisito cumplido: spec y plan `APPROVED` el 2026-10-15 (spec §14).
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado (2026-10-15, spec §14)
- [~] [T-002] Registrar SHA de `main` (`83375e6`) y SHA desplegado de `semse-API` — este último NOT_VERIFIED (sin acceso a Railway desde la sesión)
- [x] [T-003] Plan y checklist
- [x] [T-004] Investigación externa y decisiones registradas (spec §11, §13, §14)
- [x] [T-005] Runbook del censo D6 de sólo lectura (`docs/runbooks/LABOR_S0_FREE_PROJECT_CENSUS.md`)
- [ ] [T-006] Ejecutar el censo D6 — operador autorizado con rol de sólo lectura; registrar conteos o `NOT_EXECUTED`
- [x] [T-007] PR independiente D9: quitar la dirección del log de geocoding (prioridad de seguridad) — PR #938

## Fase 1 — Tests rojos

> Implementados en `apps/api/test/labor-engine-free-project-guard.test.ts` (cadena controller→service→repository real) y `labor-engine-free-project-integration.test.ts` (PostgreSQL), en vez de repartirlos entre los archivos por capa (spec §15).

- [x] [T-010] `labor-engine.service.test.ts`: N1–N4 (404 sin escritura) para PATCH, DELETE y convert
- [x] [T-011] `labor-engine.service.test.ts`: N5–N8 (403 genérico; mismo mensaje en los cuatro casos; `isJobAssignedToWorker` recibe ids del actor) y caso D8 (Job sólo vinculado a la org de W) con el resultado aprobado
- [x] [T-012] `labor-engine.service.test.ts`: N9–N10 (409), N12 (`status` en PATCH → 400), P1 (convert legítimo + audit), P2 (reintento mismo `jobId` sin escritura ni audit; archive repetido idempotente)
- [x] [T-013] [P] `labor-engine.repository.test.ts`: `where` con `createdBy`; conversión condicional `status: "active"`; N14 (`count = 0` → sin segunda escritura); `updateMany` y `auditLog.create` sobre el mismo `tx` y error de audit propagado
- [x] [T-016] [P] `labor-engine-free-project-integration.test.ts` (BD, se salta sin `DATABASE_URL`; verde contra PostgreSQL 16 local, y rojo si la escritura sale de la transacción; también lo ejecuta el job `integration` de CI): fallo forzado de audit → `status`/`convertedJobId` intactos en PostgreSQL; datos sintéticos
- [x] [T-014] [P] `labor-engine.controller.test.ts`: propaga `userId`/`orgId`/`requestId`; `status` → 400; `jobId` no string → 400 (existente); N13: `REQUIRED_PERMISSIONS_KEY` = `["field-ops:write"]` en PATCH, DELETE y convert
- [x] [T-015] Ejecutar contra `main` @ `83375e6` y guardar salida del fallo como evidencia del gap

## Fase 2 — Dominio/repositorio

- [x] [T-020] Repositorio: métodos scoped por `createdBy` y conversión/archivo condicional
- [x] [T-021] Servicio: actor en `updateFreeProject`/`archiveFreeProject`/`convertToJob`; guard de estado; validación de Job con `isJobAssignedToWorker`
- [x] [T-022] Repositorio: `tx.auditLog.create` de `convert`/`archive` en la misma `$transaction` que la escritura condicional, con `ActorContextService.ensureActorContext` antes (si D4 aprobada); el servicio no usa `AuditService`; `logger.warn` estructurado sin PII en rechazos
- [x] [T-023] Registrar acciones audit-only en `docs/foundation/EVENT_CATALOG.md` (si D4 aprobada)
- [x] [T-025] Agregar "Ownership por Agregado → FreeProject" a `docs/foundation/DOMAIN_INVARIANTS.md` (si D10 aprobada)
- [x] [T-024] Tests de Fase 1 en verde

## Fase 3 — API

- [x] [T-030] Controlador: pasar contexto completo; rechazar `status` en PATCH
- [x] [T-031] Verificar BFF passthrough sin cambios (`apps/web/app/api/semse/labor/free-projects/**`)
- [~] [T-032] Verificar a mano que `ProyectosTab` muestra el error 403/404/409 sin romper la lista — revisado en código (`labor-api.ts` lanza `LaborApiError` con el mensaje del API y `ProyectosTab` lo muestra con `setError`); prueba en navegador NOT_VERIFIED
- [x] [T-033] Registrar en `docs/architecture/SEMSE_API_SURFACE_V1.md` `PATCH`/`DELETE /v1/labor/free-projects/:id` y `POST …/convert` con sus códigos de §5 — hoy el documento no tiene ninguna ruta de Labor (verificado en `83375e6`)

## Fase 4 — Verificación local

- [x] [T-040] Tests dirigidos `labor-engine.*.test.ts` y, con Postgres local, `pnpm --filter @semse/api test:integration` (o `NOT_VERIFIED` registrado)
- [x] [T-041] `pnpm --filter @semse/api test:unit` (regresión incl. `startTimer`/manual) — 3391 pass; 8 fail preexistentes de SAT-007 dependientes de DNS
- [x] [T-042] `pnpm typecheck` (exit 0) y lint de la API (0 errores); web sin cambios
- [x] [T-043] `pnpm spec:validate:strict`
- [x] [T-044] `pnpm spec:index` y `pnpm spec:index:check`
- [x] [T-045] Spec a `code_status: COMPLETE`, `status: IMPLEMENTED`, `related_tests` vigentes

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos; sin datos reales en fixtures
- [ ] [T-051] PR acotado con evidencia de rojo→verde y recuperación por forward-fix (D7)
- [ ] [T-052] CI terminal; registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Merge sólo con autorización del owner; registrar SHA y `merge_status`

## Fase 6 — Deploy y verificación

- [ ] [T-060] Deployment terminal de `semse-API` con el SHA fusionado
- [ ] [T-061] Health/readiness y logs sin errores nuevos; ante regresión, forward-fix — nunca rollback a un deployment sin el guard
- [ ] [T-062] Smoke autenticado con dos usuarios de prueba autorizados del mismo tenant (spec §8); nunca proyectos de usuarios reales
- [ ] [T-063] Registrar `production_evidence` sin PII, `last_verified`, `status: VERIFIED`
- [ ] [T-064] Enlazar resultado en #935 y #934; no cerrar #935
- [~] [T-065] Reporte creado (`docs/reportes/2026-10-15_labor-s0-free-project-guard.md`); completar con CI/merge/deploy/smoke cuando ocurran. Crear el reporte de implementación en `docs/reportes/YYYY-MM-DD_labor-s0-free-project-guard.md` (convención de `docs/reportes/README.md`): archivos y SHAs, evidencia rojo→verde, CI, merge, deploy, smoke, lo no verificado y handoff a S1

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `ACTIVE` (sin flag, D7) con smoke verificado
- [ ] Migración `NOT_APPLICABLE`
- [ ] Evidencia de producción enlazada
- [ ] Índice de specs actualizado
- [ ] Reporte en `docs/reportes/` creado (T-065)
