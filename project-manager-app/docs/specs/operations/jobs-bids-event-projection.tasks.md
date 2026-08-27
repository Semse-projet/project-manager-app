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
      gaps detectados entre spec↔plan↔constitución): **un solo PR de
      GitHub** (#590, mandato de rama única de esta sesión), pero **dos
      commits separables** — commit 1 = Fase 0 (dispatch genérico),
      transversal y verificable en aislamiento (14/14 tests verdes antes
      de tocar jobs/bids); commit(s) siguientes = Fases A-D (schemas,
      migración, productores, consumer, read-through, tests). Detalle en
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

> Desviación honesta de proceso: T-020/T-024 pedían tests rojos antes del
> código para cada pieza. En la práctica, esta sesión escribió producer +
> consumer + builder primero y los 22 tests nuevos después (no estrictamente
> TDD rojo→verde por commit), por el volumen de piezas interdependientes
> (schemas, migración, repos, consumer, read-through) que se diseñaron
> juntas. Control compensatorio real: suite completa corrida al final
> (`node ./scripts/run-tests.mjs`) — 2069/2069 verdes, 0 fallos, sin tests
> desactivados ni relajados para pasar. No se repite esta desviación como
> costumbre; se deja registrada, no oculta.

- [x] [T-020] Tests escritos para los tres escenarios P1 del spec §4 —
      `jobs-bids-projection.test.ts` (builder), `jobs-bids-projection-events
      .test.ts` (schemas + consumer con `effect: "disabled"` explícito para
      el caso "tenant fuera del allowlist"), `operational-context.service
      .test.ts` (read-through + fallback, casos borde de §4 P1).
- [x] [T-021] [P] 6 schemas Zod creados en `domain-events-v2.schema.ts`
      (`job.created.v1`, `job.status_changed.v1`,
      `job.preferred_professional_selected.v1` — reservado, sin productor
      todavía —, `bid.created.v1`, `bid.accepted.v1`, `bid.rejected.v1`),
      cada uno con su `SCHEMA_REF`, `superRefine` de entityId↔payload y
      test de aceptación/rechazo en `jobs-bids-projection-events.test.ts`.
- [x] [T-022] [P] Fixture de "dos reconstrucciones simultáneas" cubierta
      por el test de duplicado del consumer (segunda `process()` sobre el
      mismo `eventId` devuelve `duplicate: true`, una sola fila CAS) —
      mismo mecanismo ya probado para `project-lifecycle-projection.v1`,
      reutilizado tal cual para `jobs-bids-projection.v1`.
- [x] [T-023] Decisión: **por-bid**, no agregado. Cada bid competidora
      rechazada en el bulk-reject de `bids.repository.ts:accept` recibe su
      propio `bid.rejected.v1` (`reason: "competing_bid_accepted"`,
      `entityId` = esa bid). Evita inventar un shape de payload agregado
      sin precedente en el repo; cada evento mapea 1:1 a un hecho de
      dominio verificable. Cubierto por
      `bids-outbox-producer.test.ts` (N competidoras → N eventos).
- [x] [T-024] Confirmado leyendo el código real antes de tocarlo (spec §1
      nota de verificación 2026-08-17, reconfirmada): sin `JobsBidsProjection`,
      sin `$transaction` en `jobs.repository.ts:create`/`updateStatus` ni
      en `bids.repository.ts:create`, sin outbox en `bids.repository.ts
      :accept`, dispatch del consumer con dos `if` hardcodeados — el gap
      era real, no supuesto.

## Fase 3 — Datos y dominio: bids (primero, sin `DomainEventBus` previo)

- [x] [T-030] Migración Prisma `JobsBidsProjection` escrita a mano —
      `packages/db/prisma/migrations/20260826120000_jobs_bids_projection/
      migration.sql`, mismo shape que `ProjectLifecycleProjection` más
      `clientOrgId` denormalizado (para el filtro CLIENT del read-through
      sin joinear `job`). **No generada con `prisma migrate dev`**: esta
      sesión no tiene Postgres disponible (sin Docker en el sandbox, ver
      T-002) — el SQL replica exactamente el patrón de la migración F3 ya
      aplicada en producción (`20260728000000_project_lifecycle_projection`),
      no es una migración improvisada, pero sigue **sin verificar contra
      una base real**. `pnpm db:generate` corrido y limpio (el schema
      compila), que es una verificación distinta y más débil que aplicar
      la migración de verdad.
- [ ] [T-031] Verificar SQL, checksum y compatibilidad hacia atrás contra
      Postgres real — **pendiente**, requiere `pnpm db:migrate` en un
      entorno con la base local levantada (`infra/docker/compose.semse-
      mvp.yml`), no ejecutable en esta sesión. Bloqueante antes de
      `deploy_status: DEPLOYED`.
- [x] [T-032] `bids.repository.ts:create` envuelto en `$transaction` +
      outbox. Idempotency key **no** es `bid.created.v1:<jobId>:<orgId>`
      como proponía el plan original — ver nota de diseño en el propio
      archivo: esa clave colisionaría (P2002) en un re-bid legítimo tras
      un rechazo previo, porque `DomainOutboxEvent` es único por
      `[tenantId, idempotencyKey]` sin ventana de tiempo. Se usa
      `bid.created.v1:<bidId>` (id recién generado por la propia fila,
      nunca colisiona) — bug fix sobre el plan, no cambio de contrato de
      eventos ni de nombres.
- [x] [T-033] Outbox agregado dentro del `$transaction` ya existente de
      `bids.repository.ts:accept` — `bid.accepted.v1` para la bid ganadora
      y un `bid.rejected.v1` por cada bid competidora (ver T-023).
- [x] [T-034] Consumer `jobs-bids-projection.v1` implementado en el
      registro genérico de `domain-event-consumer.service.ts` (Fase 1) +
      `JobsRepository.rebuildJobsBidsProjection()`/`persistJobsBidsProjection()`
      tenant-scoped con CAS, mismo patrón que
      `ProjectsRepository.rebuildLifecycleProjection()`.
- [x] [T-035] Tests unitarios y de persistencia de bids verdes —
      `bids-outbox-producer.test.ts` (3/3), regresión completa
      `marketplace-bids.test.ts`/`bids.controller.test.ts` sin cambios
      (ver T-061).

## Fase 4 — Datos y dominio: jobs (dual-write junto a `DomainEventBus`)

- [x] [T-040] `jobs.repository.ts:create`/`updateStatus` envueltos en
      `$transaction` + outbox — `DomainEventBus.emit()` existente en
      `jobs.service.ts` intacto, sin tocar (dual-write real, no
      reemplazo). `updateStatus` ganó `orgId`/`actorType`/`actorId`/
      `requestId` en su input (antes solo `tenantId`/`jobId`/`status`) para
      poder construir el envelope del evento; los dos call sites en
      `jobs.service.ts` (`transitionJob` y `systemCompleteJob`) actualizados.
- [x] [T-041] Consumer `jobs-bids-projection.v1` cubre los 5 eventos
      (`job.created.v1`, `job.status_changed.v1`, `bid.created.v1`,
      `bid.accepted.v1`, `bid.rejected.v1`) — todos rebuildean la misma
      proyección por `jobId` desde estado actual, no por tipo de evento.
- [x] [T-042] Test de blast radius: cubierto indirectamente — el consumer
      nuevo (`consumeJobsBidsProjection`) solo toca `JobsBidsProjection`,
      `DomainEventConsumption` y `AuditLog`; no importa ni referencia
      `PaymentEscrow`/`Milestone`/`Contract` en ningún punto del código
      (verificable por lectura directa del archivo, no solo por test). No
      se agregó un test dedicado con ese nombre exacto — la ausencia de
      cualquier import/referencia a esos tres modelos en el código nuevo
      es la evidencia.
- [x] [T-043] Suite completa de `jobs`/`bids` corrida — ver T-061 (0
      fallos, incluida `jobs.fsm.test.ts` y `marketplace-bids.test.ts`).

## Fase 5 — Read-through en `OperationalContextService`

- [x] [T-050] Suite nueva `operational-context.service.test.ts` escrita —
      cubre `invalidateScope()` en sus tres scopes (tenant/user/project),
      aislamiento entre usuarios, emisión SSE, y cache TTL — antes de
      considerar terminado el cambio al servicio.
- [x] [T-051] Lectura de `jobs` desde la proyección implementada en
      `loadJobsSummary()`, gateada por
      `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED` +
      `SEMSE_JOBS_PROJECTION_ENABLED`/allowlist de tenant. Decisión de
      diseño no especificada por el spec: la proyección solo se confía
      cuando `projectionRows.length >= min(directCount, 20)` (comparado
      contra un `job.count()` barato) — si el tenant todavía está en
      ventana de backfill (spec §7: "jobs/bids preexistentes se resuelven
      por fallback... hasta que un evento los toque"), cae a la query
      directa automáticamente, sin flag adicional.
- [x] [T-052] Fallback implementado: cualquier excepción en la rama de
      lectura de la proyección se atrapa dentro de `loadJobsSummary()` y
      cae a la query directa original — `buildContext()` nunca ve la
      excepción, `prometeoChat()` sigue sin necesitar `.catch()` nuevo.
- [x] [T-053] Test específico: "jobs read-through falls back to the direct
      query when the projection query throws" — confirma que `buildContext()`
      no lanza y el resultado viene de la query directa.
- [x] [T-054] Confirmado: los otros 13 campos de `SemseOperationalContext`
      no se tocaron — el único cambio en `buildContext()` es la fuente del
      array `jobs` (antes `this.prisma.job.findMany(...)` inline, ahora
      `this.loadJobsSummary(...)`); el resto del método es exactamente el
      mismo código.

## Fase 6 — Verificación local

- [x] [T-060] Tests dirigidos de las Fases 1-5 verdes (32 tests nuevos
      entre `event-domain-consumer.test.ts` +1, `jobs-bids-projection
      .test.ts`, `jobs-bids-projection-events.test.ts`,
      `bids-outbox-producer.test.ts`, `operational-context.service.test.ts`).
- [x] [T-061] Regresión completa corrida (no solo lo tocado, acorde a
      `risk: high`): `pnpm --filter @semse/api build && node
      ./scripts/run-tests.mjs` → **2069 passed, 0 failed, 8 skipped**
      (skipped = tests de integración gateados por `DATABASE_URL`, sin
      Postgres disponible en esta sesión — no son fallos).
- [x] [T-062] `tsc --noEmit` limpio en `apps/api` y en el workspace
      (`pnpm typecheck` — el único error que produjo es preexistente en
      `apps/web/app/(app)/tools/labor/labor-tool-client.tsx`, confirmado
      sin relación a este cambio vía `git log`/`git status` sobre ese
      archivo). `eslint` limpio en los 7 archivos de `apps/api/src`
      tocados.
- [x] [T-063] `pnpm spec:validate:strict` — ver resultado más abajo en
      este mismo commit.
- [x] [T-064] `pnpm spec:index` y `pnpm spec:coverage` corridos. Coverage:
      116 specs, este spec ahora cuenta con `related_tests` declarados
      (11 archivos); sigue listado en "High/critical risk specs not
      VERIFIED" — correcto, `status: IMPLEMENTED` todavía no es
      `VERIFIED` (eso requiere deploy + canary real, Fase 8).
- [x] [T-065] Spec actualizado a `code_status: COMPLETE`,
      `status: IMPLEMENTED`.

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
