---
type: tasks
feature: "Labor Engine — guard de ownership y destino en mutaciones de FreeProject (S0)"
domain: "labor"
plan: "docs/specs/labor/free-project-mutation-guard.plan.md"
version: "2.0"
status: "PENDING"
branch: "fix/labor-s0-free-project-guard"
date: "2026-10-15"
---

# Tareas: guard de ownership y destino en mutaciones de FreeProject (S0)

> Prerrequisito: spec `APPROVED` (D1–D10 resueltas) y plan aprobado.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [~] [T-001] Confirmar spec `APPROVED` e indexado — bloqueado: owner debe resolver D1–D10
- [ ] [T-002] Registrar SHA de `main` y SHA desplegado de `semse-API` antes de empezar
- [x] [T-003] Plan y checklist en borrador (este PR documental)
- [x] [T-004] Investigación externa y decisiones registradas (spec §11, §13)

## Fase 1 — Tests rojos

- [ ] [T-010] `labor-engine.service.test.ts`: N1–N4 (404 sin escritura) para PATCH, DELETE y convert
- [ ] [T-011] `labor-engine.service.test.ts`: N5–N8 (403 genérico; mismo mensaje en los cuatro casos; `isJobAssignedToWorker` recibe ids del actor) y caso D8 (Job sólo vinculado a la org de W) con el resultado aprobado
- [ ] [T-012] `labor-engine.service.test.ts`: N9–N10 (409), N12 (`status` en PATCH → 400), P1 (convert legítimo + audit), P2 (reintento mismo `jobId` sin escritura ni audit; archive repetido idempotente)
- [ ] [T-013] [P] `labor-engine.repository.test.ts`: `where` con `createdBy`; conversión condicional `status: "active"`; N14 (`count = 0` → sin segunda escritura); `updateMany` y `auditLog.create` sobre el mismo `tx` y error de audit propagado
- [ ] [T-016] [P] `labor-engine-free-project-integration.test.ts` (BD, se salta sin `DATABASE_URL`): fallo forzado de audit → `status`/`convertedJobId` intactos en PostgreSQL; datos sintéticos
- [ ] [T-014] [P] `labor-engine.controller.test.ts`: propaga `userId`/`orgId`/`requestId`; `status` → 400; `jobId` no string → 400 (existente); N13: `REQUIRED_PERMISSIONS_KEY` = `["field-ops:write"]` en PATCH, DELETE y convert
- [ ] [T-015] Ejecutar contra `main` @ `83375e6` y guardar salida del fallo como evidencia del gap

## Fase 2 — Dominio/repositorio

- [ ] [T-020] Repositorio: métodos scoped por `createdBy` y conversión/archivo condicional
- [ ] [T-021] Servicio: actor en `updateFreeProject`/`archiveFreeProject`/`convertToJob`; guard de estado; validación de Job con `isJobAssignedToWorker`
- [ ] [T-022] Repositorio: `tx.auditLog.create` de `convert`/`archive` en la misma `$transaction` que la escritura condicional, con `ActorContextService.ensureActorContext` antes (si D4 aprobada); el servicio no usa `AuditService`; `logger.warn` estructurado sin PII en rechazos
- [ ] [T-023] Registrar acciones audit-only en `docs/foundation/EVENT_CATALOG.md` (si D4 aprobada)
- [ ] [T-025] Agregar "Ownership por Agregado → FreeProject" a `docs/foundation/DOMAIN_INVARIANTS.md` (si D10 aprobada)
- [ ] [T-024] Tests de Fase 1 en verde

## Fase 3 — API

- [ ] [T-030] Controlador: pasar contexto completo; rechazar `status` en PATCH
- [ ] [T-031] Verificar BFF passthrough sin cambios (`apps/web/app/api/semse/labor/free-projects/**`)
- [ ] [T-032] Verificar a mano que `ProyectosTab` muestra el error 403/404/409 sin romper la lista
- [ ] [T-033] Registrar en `docs/architecture/SEMSE_API_SURFACE_V1.md` `PATCH`/`DELETE /v1/labor/free-projects/:id` y `POST …/convert` con sus códigos de §5 — hoy el documento no tiene ninguna ruta de Labor (verificado en `83375e6`)

## Fase 4 — Verificación local

- [ ] [T-040] Tests dirigidos `labor-engine.*.test.ts` y, con Postgres local, `pnpm --filter @semse/api test:integration` (o `NOT_VERIFIED` registrado)
- [ ] [T-041] `pnpm --filter @semse/api test:unit` (regresión incl. `startTimer`/manual)
- [ ] [T-042] `pnpm typecheck` y `pnpm lint`
- [ ] [T-043] `pnpm spec:validate:strict`
- [ ] [T-044] `pnpm spec:index` y `pnpm spec:index:check`
- [ ] [T-045] Spec a `code_status: COMPLETE`, `status: IMPLEMENTED`, `related_tests` vigentes

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos; sin datos reales en fixtures
- [ ] [T-051] PR acotado con evidencia de rojo→verde y rollback = revert
- [ ] [T-052] CI terminal; registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Merge sólo con autorización del owner; registrar SHA y `merge_status`

## Fase 6 — Deploy y verificación

- [ ] [T-060] Deployment terminal de `semse-API` con el SHA fusionado
- [ ] [T-061] Health/readiness y logs sin errores nuevos
- [ ] [T-062] Smoke autenticado con dos usuarios de prueba autorizados del mismo tenant (spec §8); nunca proyectos de usuarios reales
- [ ] [T-063] Registrar `production_evidence` sin PII, `last_verified`, `status: VERIFIED`
- [ ] [T-064] Enlazar resultado en #935 y #934; no cerrar #935
- [ ] [T-065] Crear el reporte de implementación en `docs/reportes/YYYY-MM-DD_labor-s0-free-project-guard.md` (convención de `docs/reportes/README.md`): archivos y SHAs, evidencia rojo→verde, CI, merge, deploy, smoke, lo no verificado y handoff a S1

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
