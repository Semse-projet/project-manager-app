---
type: checklist
feature: "SPEC-GTW-001 — Unificación del Model Gateway"
spec: "docs/specs/prometeo/model-gateway-unification.spec.md"
version: "1.0"
date: "2026-08-14"
---

# Checklist: SPEC-GTW-001 — Unificación del Model Gateway

> Generado al cierre de `/speckit.analyze`, antes de cualquier código. Los
> ítems marcados `[x]` significan "el diseño (spec+plan+tasks) lo resuelve
> explícitamente" — no "ya se ejecutó y pasó". Ningún ítem de ejecución
> real (tests corridos, build, deploy) se marca `[x]` sin evidencia, por
> `docs/SDD_GOVERNANCE.md` y Artículo XIII de la constitución. Ítems N/A
> están justificados, no omitidos en silencio.

## Requisitos

- [x] Cada escenario P1 es verificable — los 5 criterios de aceptación
      (spec §6) mapean 1:1 a tests concretos en plan §7 Fase A / tasks
      T-010 a T-014, con casos parametrizados reales (9 slugs, 5×3 combos
      de riesgo)
- [x] Scope y no-objetivos evitan ambigüedad — spec §Scope/Non-Goals claros;
      plan §3 resolvió la única ambigüedad real encontrada (bridging de
      `AiGenerateRequest`↔`CopilotRoutingContext`)
- [x] API/UI/agent contracts no se contradicen — confirmado sin cambio de
      superficie API/BFF/UI (plan §3); los 16 agentes conversacionales y
      los 8 callers reales de `executeWithSlug()` mantienen su firma

## Seguridad

- [x] Permisos se validan en backend — **N/A**, sin endpoint nuevo; el
      gateway no gatea por rol, los callers ya aplican su propio RBAC antes
      de llegar acá (plan §5)
- [ ] Tenant, org, ownership y resource scope están probados — **diseñado**
      (flag `_CANARY_TENANT_IDS` tenant-scoped, T-030a/T-063), **no
      ejecutado todavía** — pendiente de Fase 6 real
- [x] Step-up/aprobación existe para acciones críticas — activación del
      flag es explícitamente acción humana, no de agente (T-063,
      `AGENTS.md`)
- [ ] No hay secretos ni PII en logs/evidencia — verificación explícita
      planeada (T-050), **pendiente de ejecución** (nada implementado
      todavía)

## Datos y eventos

- [x] Migración es reproducible y compatible — **N/A**, sin cambio de
      `packages/db/prisma/schema.prisma` (plan §4, confirmado por lectura
      de spec completo)
- [x] Backfill, rollback o forward-fix están definidos — rollback = flag +
      reversión por paso de migración (spec §4, plan §4/§8); sin datos
      persistidos que revertir
- [x] Estado + outbox son atómicos cuando aplica — **N/A**, sin domain
      events ni outbox en este spec (plan §6)
- [x] Consumers son idempotentes y replayables — **N/A**, sin consumers

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática — **N/A**, sin
      workflow de evidencia
- [x] Payment Governance bloquea releases incompatibles — **N/A**, sin
      lógica de liberación de fondos tocada (plan §5, explícito)
- [ ] Cálculos financieros excluyen fallos/reversals — **N/A directo** para
      este spec, pero dos callers reales con impacto financiero indirecto
      (`receipt-ocr.service.ts`, `budget-intelligence.service.ts`) quedan
      con regresión dedicada planeada (tasks T-041) — **pendiente de
      ejecución**, no de diseño

## Entrega

- [ ] Tests, build, typecheck y lint pasan — **pendiente**, nada
      implementado todavía (Fase 4, tasks T-040-T-044)
- [x] CI, merge, deploy y activación tienen evidencia separada — diseño
      garantiza esto por construcción: 5 PRs reversibles + flag de
      activación separado del código (plan §7 Fase E/F, tasks Fase 5/6)
- [x] Healthcheck no sustituye smoke funcional — T-064 (smoke autenticado
      real por combinación de gate) explícitamente separado de T-062
      (healthcheck)
- [x] Canary, métricas y rollback están definidos — T-063 (canary
      gradual)/T-065 (métricas/SLO, señal de rollback explícita en plan §8)
- [ ] `production_evidence` no contiene secretos — se verificará al
      registrar evidencia real (T-067), **pendiente de ejecución**

## Documentación

- [x] Spec index regenerado — hecho para el spec en sí (PR #579); `plan.md`/
      `tasks.md`/este checklist no forman parte del conteo de
      `spec:validate:strict` (confirmado: 108 specs sin cambio al
      agregarlos)
- [ ] API surface/event catalog/matriz/roadmap actualizados si aplica —
      **pendiente a propósito**: `IMPLEMENTATION_STATUS_MATRIX.md` no
      referencia esta capacidad todavía porque no hay código que
      documentar como implementado — se actualiza en Fase 4 (T-045) cuando
      corresponda, no antes
- [x] Investigación externa y decisiones registradas — plan §9 (N/A,
      investigación 100% de código interno); decisión de clasificación de
      providers (spec §5, 2026-08-14) y de `riskLevel`/`AiTaskType`
      (plan §3, 2026-08-14) registradas con fecha y quién decidió

## Hallazgo del `/speckit.analyze` que motivó este checklist

Ver sección `/speckit.analyze` al final de `model-gateway-unification.tasks.md`
— una inconsistencia real plan↔tasks (T-031 no gateaba el cambio de
`executeWithSlug()` detrás del flag que el propio plan diseñaba) se
encontró y corrigió antes de llegar a este checklist, no después.
