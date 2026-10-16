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
- [x] [T-002] Baseline vulnerable `83375e6`; deploy `semse-API` SHA `6eae43cb56888ade2d180dfa12f9350a48c17300` SUCCESS a las 2026-10-15T18:15:53Z en Railway.
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

- [x] [T-050] Diff y revisión de seguridad de #937 completados antes de merge; el PR documenta alcance sin secretos en fixtures.
- [x] [T-051] PR #937 fusionado; recuperación forward-fix D7 documentada.
- [x] [T-052] CI final de #937 9/9 PASS (head 372846cb); CI #941 SUCCESS run 38777634351.
- [x] [T-053] Revisión de #937: hilo P1 D10 contestado con aprobación expresa del owner el 2026-10-15 y marcado resuelto.
- [x] [T-054] Merge #937 SHA 29bf284ca2eb982afad948bb3f80bec395e9f604; #938 y #941 también fusionados.

## Fase 6 — Deploy y verificación

- [x] [T-060] Railway production semse-API desplegado: SUCCESS 2026-10-15T18:15:53Z, SHA 6eae43cb56888ade2d180dfa12f9350a48c17300.
- [~] [T-061] GET /v1/ready: ready + storage ok a las 18:23:17Z; servicio online y sin work pending. Queda evaluación completa de logs/avisos y subida autenticada.
- [ ] [T-062] Smoke autenticado 13/13 en producción NO EJECUTADO. Hay dos sesiones de prueba A/B navegables, pero la igualdad de tenant y el Job sintético autorizado NO ESTÁN CONFIRMADOS por backend. Script y runbook disponibles.
- [ ] [T-063] Registrar `production_evidence` sin PII, `last_verified`, `status: VERIFIED`
- [ ] [T-064] Enlazar resultado en #935 y #934; no cerrar #935
- [~] [T-065] Reporte actualizado con CI/merge/deploy/D10 y navegación A/B, pero NO COMPLETO hasta smoke 13/13, T-032 y D6 (o NOT_EXECUTED justificado).

## Criterio de Done

- [x] Código completo y tests dirigidos de S0 verdes; fallos DNS de entorno local documentados, CI PASS
- [x] CI `PASS` (#937 y #941)
- [x] Merge `MERGED` (#937/#938/#941)
- [x] Deploy `DEPLOYED` (API SUCCESS `6eae43cb`)
- [ ] Activación `ACTIVE` (sin flag, D7) con smoke verificado
- [x] Migración `NOT_APPLICABLE`
- [ ] Evidencia de producción enlazada
- [ ] Índice de specs actualizado
- [x] Reporte en `docs/reportes/` creado (T-065); aceptación final pendiente
