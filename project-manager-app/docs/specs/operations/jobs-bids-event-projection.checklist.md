---
type: checklist
feature: "Jobs & Bids Event Projection for Agent Context"
spec: "docs/specs/operations/jobs-bids-event-projection.spec.md"
version: "1.0"
date: "2026-08-06"
---

# Checklist: Jobs & Bids Event Projection for Agent Context

## Requisitos

- [ ] Cada escenario P1 es verificable
- [ ] Scope y no-objetivos evitan ambigüedad (FSM de Job/Bid explícitamente
      fuera de alcance; `DomainEventBus`/`AgentTriggerRouter` explícitamente
      no se retiran)
- [ ] API/UI/agent contracts no se contradicen — no hay endpoint nuevo, solo
      cambio de fuente interna en `buildContext()`

## Seguridad

- [ ] Permisos se validan en backend — sin permisos nuevos, se reutilizan
      `domain-events:read/replay` y el rol `EVENT_CONSUMER`
- [ ] Tenant, org, ownership y resource scope están probados —
      `JobsBidsProjection` es `tenantId`-scoped, mismo patrón que F3
- [ ] Step-up/aprobación existe para acciones críticas — no aplica, sin
      escritura de dominio ni liberación de fondos
- [ ] No hay secretos ni PII en logs/evidencia

## Datos y eventos

- [ ] Migración es reproducible y compatible (aditiva, `CREATE TABLE`
      únicamente)
- [ ] Backfill, rollback o forward-fix están definidos — sin backfill, la
      tabla se puebla hacia adelante; rollback documentado en el runbook
- [ ] Estado + outbox son atómicos cuando aplica — sí para `bids` (`create`,
      `accept`) y para el insert de outbox nuevo en `jobs`; el
      `DomainEventBus.emit()` preexistente en jobs sigue siendo
      post-commit best-effort, explícitamente no se le atribuye atomicidad
      nueva
- [ ] Consumers son idempotentes y replayables (`DomainEventConsumption`
      único por `[eventId, consumerName]`)

## Evidencia y dinero

- [ ] Evidencia no se confunde con aprobación automática — no aplica, esta
      spec no toca el módulo Evidence
- [ ] Payment Governance bloquea releases incompatibles — no aplica
      directamente, pero el blast-radius test (T-042) confirma que
      `PaymentEscrow` no se muta como efecto colateral
- [ ] Cálculos financieros excluyen fallos/reversals — no aplica, esta
      proyección no calcula montos, solo refleja estado de `Job`/`Bid`

## Riesgo específico de esta spec (no genérico del template)

- [ ] El fallback de `buildContext()` a query directa está probado
      explícitamente para el path sin `.catch()` de
      `POST /prometeo/chat` (`ai-models.controller.ts:229`) — este es el
      ítem de mayor riesgo de todo el plan, no un checkbox de rutina
- [ ] `invalidateScope()` tiene test real antes de tocar
      `OperationalContextService` — hoy solo existe un stub mockeado en
      `ai-models.controller.test.ts`, y esa lógica la comparten 10 call
      sites ajenos a este cambio (milestones, payments, disputes, etc.)
- [ ] `jobs.fsm.test.ts` (39 bloques) y `marketplace-bids.test.ts`
      (28 bloques) siguen en verde después de envolver los write paths en
      `$transaction`

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Healthcheck no sustituye smoke funcional
- [ ] Canary, métricas y rollback están definidos
      (`docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md`)
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`)
- [ ] `EVENT_CATALOG.md` actualizado con la sección `## Bids` y la
      reconciliación de nombres `job.*` — recién al pasar a `APPROVED`,
      no antes (ver spec sección 6)
- [ ] `ROADMAP.md` — número de fase asignado (F0-F10 están todos ocupados
      hoy; no asumir un número sin confirmación de quien gobierna el
      roadmap)
- [ ] `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` actualizado de DRAFT a
      ejecutable, con su nota de gobernanza resuelta
- [ ] Investigación externa y decisiones registradas — no aplica búsqueda
      nueva, ya señalado en spec sección 11

## Análisis Spec Kit

- [ ] Constitución, spec, plan y tasks no se contradicen
- [ ] `analyze` resolvió si Fase 0 (dispatch genérico) va en PR separado
      por ser transversal a F1/F3 (pregunta abierta desde el plan,
      sección 10)
- [ ] API surface, event catalog, matriz, roadmap e índice reflejan el
      estado real, no el propuesto, hasta que cada etapa se verifique
- [ ] `DRAFT` no se presenta como `APPROVED` en ningún documento derivado
      (el runbook ya lo señala; este checklist lo reafirma)
