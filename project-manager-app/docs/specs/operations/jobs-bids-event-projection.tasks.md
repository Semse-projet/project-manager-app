---
type: tasks
feature: "Jobs & Bids Event Projection for Agent Context"
domain: "operations"
plan: "docs/specs/operations/jobs-bids-event-projection.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/jobs-bids-event-projection"
date: "2026-08-06"
---

# Tareas: Jobs & Bids Event Projection for Agent Context

> Prerrequisito: plan aprobado y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
>
> El plan (sección 10) deja abierta una pregunta de scope: si la Fase 0
> (dispatch genérico del consumer) debería ser un PR separado por ser
> transversal a F1/F3, no específica de este dominio. Resolver eso en
> `analyze`, antes de T-001, no durante la ejecución.

## Fase 0 — SDD y verdad

- [ ] [T-001] Confirmar spec `APPROVED` e indexado (`pnpm spec:index`)
- [ ] [T-002] Registrar SHA Git/producción, migraciones y flags actuales
      (no asumir el snapshot de `ROADMAP.md` al 2026-08-04, reconfirmar)
- [ ] [T-003] Completar `analyze` (spec↔plan↔constitución) y decidir si
      Fase 0 del plan (dispatch genérico) va en PR separado
- [ ] [T-004] Registrar investigación externa y decisiones — no aplica
      búsqueda nueva, dejar constancia explícita de eso en el reporte

## Fase 1 — Dispatch genérico del consumer (F1-F, transversal)

- [ ] [T-010] Escribir test rojo: un `eventType` nuevo no listado hoy debe
      poder registrarse sin tocar `domain-event-consumer.service.ts`
- [ ] [T-011] Refactorizar los dos `if` hardcodeados a un registro
      `eventType → consumer handler`
- [ ] [T-012] Confirmar que `evidence-readiness.v1` y
      `project-lifecycle-projection.v1` siguen pasando sin cambio de
      comportamiento tras el refactor (regresión, no feature nueva)

## Fase 2 — Tests y contratos de jobs/bids

- [ ] [T-020] Escribir tests rojos de los escenarios P1 del spec
- [ ] [T-021] [P] Crear los 6 schemas Zod
      (`job.created.v1`, `job.status_changed.v1`,
      `job.preferred_professional_selected.v1`, `bid.created.v1`,
      `bid.accepted.v1`, `bid.rejected.v1`) en `domain-events-v2.schema.ts`
- [ ] [T-022] [P] Definir fixtures de idempotencia/concurrencia (dos
      reconstrucciones simultáneas del mismo job)
- [ ] [T-023] Decidir y documentar si `bid.rejected.v1` se emite por-bid o
      agregado (bulk-reject implícito en `bids.repository.ts:accept`)
- [ ] [T-024] Confirmar que el fallo inicial de los tests demuestra el gap
      real (proyección no existe, campo `jobs` viene de query directa)

## Fase 3 — Datos y dominio: bids (primero, sin `DomainEventBus` previo)

- [ ] [T-030] Crear migración Prisma `JobsBidsProjection` (mismo shape que
      `ProjectLifecycleProjection`)
- [ ] [T-031] Verificar SQL, checksum y compatibilidad hacia atrás
- [ ] [T-032] Envolver `bids.repository.ts:create` en `$transaction` +
      outbox, idempotency key `bid.created.v1:<jobId>:<orgId>`
- [ ] [T-033] Agregar outbox dentro del `$transaction` ya existente de
      `bids.repository.ts:accept` (`bid.accepted.v1` + `bid.rejected.v1`
      según T-023)
- [ ] [T-034] Implementar consumer `jobs-bids-projection.v1` +
      `rebuild(jobId)` tenant-scoped con CAS
- [ ] [T-035] Pasar tests unitarios y de persistencia de bids

## Fase 4 — Datos y dominio: jobs (dual-write junto a `DomainEventBus`)

- [ ] [T-040] Envolver `jobs.repository.ts:create`/`updateStatus` en
      `$transaction` + outbox — sin retirar el `DomainEventBus.emit()`
      existente en `jobs.service.ts`
- [ ] [T-041] Extender el consumer `jobs-bids-projection.v1` para cubrir
      los eventos de job además de bid
- [ ] [T-042] Test de blast radius: `PaymentEscrow`/`Milestone`/`Contract`
      no cambian por efecto de este consumer
- [ ] [T-043] Pasar tests unitarios y de persistencia de jobs, incluida
      regresión de `jobs.fsm.test.ts` (39 bloques) y
      `marketplace-bids.test.ts` (28 bloques)

## Fase 5 — Read-through en `OperationalContextService`

- [ ] [T-050] Escribir suite `operational-context.service.test.ts` (no
      existe hoy) cubriendo `invalidateScope()` antes de tocar el servicio
- [ ] [T-051] Implementar lectura de `jobs` desde la proyección, gateada
      por `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED` + allowlist de
      tenant
- [ ] [T-052] Implementar fallback obligatorio a query directa si la
      proyección falla o el tenant no está allowlisted — sin propagar
      excepción en `prometeoChat()`
- [ ] [T-053] Test específico: `buildContext()` no lanza si la proyección
      falla, en el path sin `.catch()` de `ai-models.controller.ts:229`
- [ ] [T-054] Confirmar que los otros 13 campos de
      `SemseOperationalContext` no cambian de comportamiento

## Fase 6 — Verificación local

- [ ] [T-060] Tests dirigidos (Fases 1-5 completas)
- [ ] [T-061] Regresión proporcional al riesgo (`risk: high` en el spec —
      correr la suite completa de `jobs`/`bids`/`ai-models`, no solo lo
      tocado)
- [ ] [T-062] Build/typecheck/lint
- [ ] [T-063] `pnpm spec:validate:strict`
- [ ] [T-064] `pnpm spec:coverage` y `pnpm spec:index`
- [ ] [T-065] Actualizar spec a `code_status: COMPLETE` y
      `status: IMPLEMENTED`

## Fase 7 — PR, CI y merge

- [ ] [T-070] Revisar diff y secretos
- [ ] [T-071] Decidir según T-003: uno o dos PRs (dispatch genérico
      transversal vs instrumentación jobs/bids)
- [ ] [T-072] Abrir PR(s) con migración, rollback y evidencia de
      blast-radius test
- [ ] [T-073] Esperar CI terminal y registrar `ci_status`
- [ ] [T-074] Resolver review sin ampliar scope
- [ ] [T-075] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 8 — Deploy y activación (sigue `JOBS_BIDS_PROJECTION_CANARY.md`)

- [ ] [T-080] Verificar pre-deploy/migración
- [ ] [T-081] Esperar deployment terminal API/Worker
- [ ] [T-082] Verificar rol `EVENT_CONSUMER` en el Worker (mismo incidente
      que F3 tuvo con roles faltantes — revisar antes, no después)
- [ ] [T-083] Activar `SEMSE_JOBS_PROJECTION_ENABLED` +
      `PERSIST_ENABLED` para el tenant canario, sin read-through todavía
- [ ] [T-084] Ejecutar la verificación del runbook (outbox, receipt,
      duplicado, replay)
- [ ] [T-085] Validar checklist de cierre heredado/adaptado/nuevo del
      runbook (SLO de F1, blast radius, mismatch)
- [ ] [T-086] Activar `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED` para el
      mismo tenant, con monitoreo de 5xx en `/prometeo/chat`
- [ ] [T-087] Promover a `ACTIVE` (global) o revertir/pausar según SLO
- [ ] [T-088] Registrar `production_evidence`, `last_verified` y
      `status: VERIFIED` — sin inventar IDs, solo con evidencia real
- [ ] [T-089] Actualizar `EVENT_CATALOG.md` (sección `## Bids` nueva +
      reconciliación de nombres `job.*`), `ROADMAP.md` (asignar número de
      fase) y el runbook (de DRAFT a verificado)

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado
- [ ] Migración `VERIFIED`
- [ ] Evidencia de producción enlazada
- [ ] Índice/matriz/roadmap/catálogo de eventos actualizados
