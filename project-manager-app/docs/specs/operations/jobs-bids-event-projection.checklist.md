---
type: checklist
feature: "Jobs & Bids Event Projection for Agent Context"
spec: "docs/specs/operations/jobs-bids-event-projection.spec.md"
version: "1.1"
date: "2026-08-26"
---

# Checklist: Jobs & Bids Event Projection for Agent Context

> `[x]` = verificado contra el código real en esta sesión, `[ ]` = pendiente
> de CI/merge/deploy/activación, `[N/A]` = no aplica con justificación.

## Requisitos

- [x] Cada escenario P1 es verificable — los tres de spec §4 tienen test:
      read-through coincide con query directa (`operational-context
      .service.test.ts`), consumer no muta dominios ajenos (por lectura
      directa del código, ver Riesgo específico más abajo), replay no
      duplica (`jobs-bids-projection-events.test.ts`).
- [x] Scope y no-objetivos evitan ambigüedad — FSM de Job/Bid no tocado
      (verificado: cero cambios en `jobStatusMap`/transiciones);
      `DomainEventBus`/`AgentTriggerRouter` no se retiraron, siguen
      llamándose exactamente igual desde `jobs.service.ts`.
- [x] API/UI/agent contracts no se contradicen — cero endpoints nuevos,
      `SemseOperationalContext` no cambió de forma (mismo campo `jobs`,
      mismo shape `{active, waitingProposals, completed, recent}`).

## Seguridad

- [x] Permisos se validan en backend — sin permisos nuevos.
- [x] Tenant, org, ownership y resource scope están probados —
      `JobsBidsProjection` es `tenantId`-scoped (FK a `Tenant`), y el
      read-through respeta el filtro `clientOrgId` para `CLIENT` que ya
      usaba la query directa (test dedicado).
- [N/A] Step-up/aprobación para acciones críticas — sin escritura de
      dominio ni liberación de fondos alcanzable desde esta spec.
- [x] No hay secretos ni PII en logs/evidencia — payloads de eventos son
      `jobId`/`bidId`/orgIds/montos/estados, mismo nivel de dato que ya
      viaja en `DomainOutboxEvent` para evidence/project-lifecycle.

## Datos y eventos

- [~] Migración es reproducible y compatible — SQL escrito a mano
      replicando el patrón F3 exacto (aditiva, `CREATE TABLE` únicamente,
      sin tocar `Job`/`Bid`), pero **no verificada contra Postgres real**
      en esta sesión (sin Docker/DB disponible — ver tasks.md T-031).
      Bloqueante antes de `migration_status: VERIFIED`.
- [x] Backfill, rollback o forward-fix están definidos — sin backfill, la
      tabla se puebla hacia adelante; jobs preexistentes usan fallback
      hasta que un evento los toque (probado explícitamente).
- [x] Estado + outbox son atómicos cuando aplica — sí para `bids.create`,
      `bids.accept` y `jobs.create`/`jobs.updateStatus` (los cuatro ahora
      envueltos en `$transaction` junto con su insert de outbox); el
      `DomainEventBus.emit()` preexistente en jobs sigue siendo
      post-commit best-effort, sin atomicidad nueva atribuida.
- [x] Consumers son idempotentes y replayables — `DomainEventConsumption`
      único por `[eventId, consumerName]`, mismo mecanismo que
      `evidence-readiness.v1`/`project-lifecycle-projection.v1`, probado
      con el caso de entrega duplicada.

## Evidencia y dinero

- [N/A] Evidencia no se confunde con aprobación automática — esta spec no
      toca el módulo Evidence.
- [x] Payment Governance bloquea releases incompatibles — no aplica
      directamente (sin fondos), y verificado por lectura directa que
      `consumeJobsBidsProjection`/`rebuildJobsBidsProjection` no
      importan ni referencian `PaymentEscrow`, `Milestone` ni `Contract`
      en ningún punto.
- [N/A] Cálculos financieros excluyen fallos/reversals — la proyección no
      calcula montos, solo refleja `amount`/`etaDays` ya existentes en
      `Bid`.

## Riesgo específico de esta spec (no genérico del template)

- [x] El fallback de `buildContext()` a query directa está probado
      explícitamente para el path sin `.catch()` de `POST /prometeo/chat`
      — tres tests: proyección lanza excepción, proyección incompleta
      (backfill), y flags apagados (nunca toca la tabla).
- [x] `invalidateScope()` tiene test real antes de tocar
      `OperationalContextService` — suite nueva
      `operational-context.service.test.ts`, cubre los tres scopes
      (tenant/user/project) y aislamiento entre usuarios; antes de este
      cambio solo existía el stub mockeado en `ai-models.controller
      .test.ts` (confirmado, spec §9 lo señalaba correctamente).
- [x] `jobs.fsm.test.ts` y `marketplace-bids.test.ts` siguen en verde
      después de envolver los write paths en `$transaction` — confirmado
      en la corrida completa (T-061): 2069/2069 tests, 0 fallos.

## Entrega

- [x] Tests, build, typecheck y lint pasan — ver tasks.md T-060-T-062.
- [x] CI, merge, deploy y activación tienen evidencia separada — CI `PASS`
      y merge `MERGED` (PR #590, merge commit `4649dfb`, fusionado por
      `Samuelcastella`); deploy/activación siguen pendientes (Fase 8, sin
      acceso a Railway desde esta sesión).
- [ ] Healthcheck no sustituye smoke funcional — pendiente, requiere
      canario real siguiendo el runbook (Fase 8 de tasks.md, sin acceso a
      Railway desde esta sesión).
- [x] Canary, métricas y rollback están definidos —
      `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` (DRAFT, prerrequisito
      de gobernanza ya satisfecho por este spec `APPROVED`); rollback =
      revertir PR, migración aditiva no requiere revertirse.
- [N/A] `production_evidence` no contiene secretos — vacío todavía, se
      llena en Fase 8.

## Documentación

- [x] Spec index regenerado (`pnpm spec:index`).
- [x] `EVENT_CATALOG.md` actualizado con la sección `## Jobs & Bids Event
      Projection` (reemplaza la antigua `## Jobs` aspiracional) y los 6
      nombres `.v1` reconciliados/agregados.
- [ ] `ROADMAP.md` — número de fase asignado. No asumido en esta sesión;
      queda para quien gobierna el roadmap, consistente con la nota
      original de este checklist.
- [ ] `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` actualizado de DRAFT a
      ejecutable — pendiente, depende de que Fase 8 (deploy/activación
      real) se ejecute primero para documentar pasos verificados, no
      hipotéticos.
- [N/A] Investigación externa y decisiones registradas — no aplica
      búsqueda nueva, ya señalado en spec sección 11.

## Análisis Spec Kit

- [x] Constitución, spec, plan y tasks no se contradicen — `pnpm
      spec:validate:strict` → 0 errores, 0 warnings sobre 116 specs.
- [x] La pregunta abierta del plan (sección 10 original) sobre si Fase 0
      va en PR separado quedó resuelta — corrección 2026-08-26: bajo el
      mandato de rama única de esta sesión, "PR separado" no es
      literalmente ejecutable; se resolvió como **commit separado y
      verificado en aislamiento** dentro del mismo PR (#590). Ver plan.md
      §7 Fase 0 y tasks.md T-003.
- [x] API surface, event catalog, matriz, roadmap e índice reflejan el
      estado real, no el propuesto — `EVENT_CATALOG.md` documenta
      explícitamente que `job.preferred_professional_selected.v1` es un
      schema reservado sin productor todavía, no un evento ya emitido.
- [x] `DRAFT` no se presenta como `APPROVED` en ningún documento derivado
      — el runbook de canary permanece `DRAFT` intencionalmente (Fase 8
      no ejecutada); este checklist no lo reescribe.
