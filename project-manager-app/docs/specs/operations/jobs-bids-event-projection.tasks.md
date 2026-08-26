---
type: tasks
feature: "Jobs & Bids Event Projection for Agent Context"
domain: "operations"
plan: "docs/specs/operations/jobs-bids-event-projection.plan.md"
version: "1.1"
status: "IN_PROGRESS"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-26"
---

# Tareas: Jobs & Bids Event Projection for Agent Context

> Prerrequisito: plan aprobado y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
>
> Retomado 2026-08-26 en `claude/roadmap-continuation-vhmve9` (la rama
> `feat/jobs-bids-event-projection` del plan original nunca se creó). T-003
> queda resuelto abajo.

## Fase 0 — SDD y verdad

- [x] [T-001] Confirmar spec `APPROVED` e indexado — ya `APPROVED` desde
      2026-08-17, indexado en `docs/SPEC_INDEX.md`.
- [x] [T-002] Registrar SHA Git/producción, migraciones y flags actuales —
      `origin/main` SHA `862f13fa2a26286bcacf9e1c7353ef08173a91de`
      (2026-08-26); ninguna migración de esta spec existe todavía
      (confirmado, ver `packages/db/prisma/migrations/`); `.env.example`
      declara `SEMSE_EVENT_TYPE_ALLOWLIST`/`SEMSE_EVENT_CONSUMER_ALLOWLIST`
      vacíos por defecto (sin valores hardcodeados en el repo — se llenan
      por entorno); los cuatro flags `SEMSE_JOBS_PROJECTION_*` no existen
      aún en ningún archivo. No hay acceso a `railway status` desde esta
      sesión — deploy/activación quedan fuera del alcance ejecutable acá
      (ver Fase 8).
- [x] [T-003] Decisión de scope (sin `analyze` formal — spec y plan ya
      verificados línea por línea contra código real en 2026-08-17/26, sin
      gaps detectados entre spec↔plan↔constitución): **dos PRs**. PR 1 =
      Fase 0 (dispatch genérico), transversal y verificable en aislamiento.
      PR 2 = Fases A-D (schemas, migración, productores, consumer,
      read-through, tests), sobre PR 1 ya mergeado. Detalle en
      `jobs-bids-event-projection.plan.md` §7 Fase 0.
- [x] [T-004] Investigación externa — no aplica, confirmado (spec §11 ya lo
      documenta); el diseño reutiliza los patrones propios de F1/F3
      (`evidence.repository.ts`, `project-lifecycle-projection.ts`) sin
      búsqueda nueva.

## Fase 1 — Dispatch genérico del consumer (F1-F, transversal)

- [x] [T-010] Test rojo escrito — ajustado en alcance: literalmente "sin
      tocar el archivo" hubiera exigido registro por DI externa
      (sobre-ingeniería para dos consumers reales); el test que sí se
      escribió (`event-domain-consumer.test.ts`, caso "F1-F generalized
      dispatch") prueba la propiedad que importa — un `eventType`
      allowlisted sin handler registrado se rechaza identificándose a sí
      mismo (`eventType` en la respuesta), **sin** consultar el allowlist
      de `evidence-readiness.v1` como hacía el `else` implícito de antes.
      Falló antes del refactor (el `else` viejo atribuía cualquier tipo
      desconocido a `EVIDENCE_READINESS_CONSUMER`).
- [x] [T-011] Refactorizado: `domain-event-consumer.service.ts` ahora
      construye `handlersByEventType` (`ReadonlyMap<eventType,
      EventHandlerDescriptor>`) una vez en el constructor; `process()`
      despacha por lookup, sin `if` hardcodeados. Agregar un consumer nuevo
      es una entrada nueva en `buildHandlerRegistry()`, no una rama nueva.
- [x] [T-012] Confirmado sin cambio de comportamiento: los 14 tests de
      `event-domain-consumer.test.ts` + `project-lifecycle-projection-
      events.test.ts` pasan (`node --experimental-strip-types --test`,
      contra `dist/` recompilado); `tsc --noEmit` y `eslint` limpios. Único
      cambio de comportamiento real: un `eventType` allowlisted sin
      handler ahora responde 422 "No consumer handler is registered..."
      con su propio `eventType`, en vez de ser evaluado (incorrectamente)
      contra el allowlist de `evidence-readiness.v1` — caso no cubierto
      por ningún test existente antes de este cambio (confirmado por
      grep), por lo que no es una regresión.

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
