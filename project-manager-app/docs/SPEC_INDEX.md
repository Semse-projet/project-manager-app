# SPEC_INDEX — SEMSEproject
**Última actualización:** 2026-05-20
**Mantenido por:** Architecture Agent / CTO Agent
**Propósito:** Registry canónico de todos los documentos de especificación. Todo agente de IA debe leer este índice antes de trabajar en cualquier feature.

> **Regla de oro:** Si no está en este índice, no está especificado. Si no está especificado, no se codifica.

---

## Cómo leer este índice

**Estados:**
- `APPROVED` — fuente de verdad, se puede implementar desde aquí
- `DRAFT` — en construcción, no implementar hasta aprobar
- `PARTIAL` — existe pero incompleto, verificar antes de usar
- `MISSING` — necesita crearse antes de implementar el dominio
- `DEPRECATED` — no usar, existe solo como referencia histórica
- `REVIEW_REQUIRED` — existe pero puede estar desactualizado

**Columnas:** Dominio | Documento | Ruta | Estado | Tests asociados | Acción requerida

---

## NIVEL 0 — Constitución y Gobierno

| Documento | Ruta | Estado | Acción |
|---|---|---|---|
| Constitución del proyecto | `.specify/memory/constitution.md` | APPROVED | Leer siempre primero |
| Gobierno SDD | `docs/SDD_GOVERNANCE.md` | APPROVED | Leer antes de cualquier sesión de codificación |
| Este índice | `docs/SPEC_INDEX.md` | APPROVED | Actualizar al crear/modificar specs |

---

## NIVEL 1 — Visión y Estrategia

| Documento | Ruta | Estado | Acción |
|---|---|---|---|
| Visión core | `labosemse/vision_core.md` | APPROVED | — |
| Principios de producto | `labosemse/VISION_PRINCIPLES_FOR_PRODUCT.md` | APPROVED | — |
| Decisiones bloqueadas | `labosemse/VISION_DECISIONS_LOCKED.md` | APPROVED | No violar |
| Glosario canónico | `labosemse/VISION_GLOSSARY.md` | APPROVED | Usar terminología de aquí |
| Métricas de éxito | `labosemse/VISION_SUCCESS_METRICS.md` | APPROVED | — |
| Visión ejecutiva | `labosemse/VISION_EXECUTIVE_SUMMARY.md` | APPROVED | — |
| Visión para founders | `labosemse/VISION_FOR_FOUNDERS.md` | APPROVED | — |
| Visión SEMSE + Prometeo | `labosemse/VISION_FUSIONADA_SEMSE_PROMETEO.md` | APPROVED | — |
| Visión narrativa | `labosemse/VISION_NARRATIVE.md` | APPROVED | — |
| Pilares | `labosemse/VISION_PILLARS.md` | APPROVED | — |
| Ecosystem system map | `SEMSE_ecosystem_system_map_2026-03-28.md` | APPROVED | — |
| Blueprint maestro | `docs/blueprints/` | APPROVED | Referencia principal de arquitectura |

---

## NIVEL 2 — Dominio y Arquitectura

| Documento | Ruta | Estado | Acción |
|---|---|---|---|
| Mapa de dominio | `docs/domain-map.md` | APPROVED | — |
| Arquitectura general | `docs/architecture.md` | APPROVED | — |
| Scope MVP | `specs/mvp-scope.md` | APPROVED | Define qué se implementa en MVP |
| Entidades canónicas | `specs/entities.md` | APPROVED | — |
| Workflows core | `specs/SEMSE_CORE_WORKFLOWS.md` | APPROVED | — |
| Workflows (alias) | `specs/workflows.md` | REVIEW_REQUIRED | Verificar vs SEMSE_CORE_WORKFLOWS |
| Entidades iniciales | `specs/SEMSE_INITIAL_ENTITIES.md` | REVIEW_REQUIRED | Verificar vs entities.md |
| Agents (16 roles) | `AGENTS.md` | APPROVED | Leer antes de crear agentes |
| Checklist absorción | `SEMSE_ABSORPTION_EXECUTION_CHECKLIST.md` | ACTIVE | Plan de consolidación en curso |

---

## NIVEL 3 — Architecture Decision Records (ADRs)

| ADR | Ruta | Estado |
|---|---|---|
| Monorepo shape | `docs/adrs/ADR-0001-monorepo-shape.md` | APPROVED |
| API framework | `docs/adrs/ADR-0002-api-framework.md` | APPROVED |
| Data layer | `docs/adrs/ADR-0003-data-layer.md` | APPROVED |
| Agent run lifecycle | `docs/adrs/ADR-0004-agent-run-lifecycle.md` | APPROVED |
| Monorepo structure (v2) | `docs/adrs/ADR-001-monorepo-structure.md` | REVIEW_REQUIRED |
| Core logic isolation | `docs/adrs/ADR-002-core-logic-isolation.md` | APPROVED |
| Explicit FSM modeling | `docs/adrs/ADR-002-explicit-fsm-modeling.md` | APPROVED |
| FSM for workflow control | `docs/adrs/ADR-002-fsm-for-workflow-control.md` | REVIEW_REQUIRED |
| Async-first heavy workloads | `docs/adrs/ADR-003-async-first-heavy-workloads.md` | APPROVED |
| Auditable internal ledger | `docs/adrs/ADR-003-auditable-internal-ledger.md` | APPROVED |
| Ledger-first payments | `docs/adrs/ADR-003-ledger-first-payments.md` | APPROVED |

---

## NIVEL 4 — Contratos de API (por dominio)

| Dominio | Ruta | Estado | Tests | Acción |
|---|---|---|---|---|
| Auth | `specs/api/auth.spec.md` | MISSING | MISSING | CREAR |
| Jobs / Marketplace | `specs/api/jobs.spec.md` | MISSING | MISSING | CREAR |
| Bids | `specs/api/bids.spec.md` | MISSING | MISSING | CREAR |
| Work Orders | `specs/api/work-orders.spec.md` | MISSING | MISSING | CREAR |
| Milestones | `specs/api/milestones.spec.md` | MISSING | MISSING | CREAR |
| Evidence | `specs/api/evidence.spec.md` | MISSING | MISSING | CREAR |
| Payments / Escrow | `specs/api/payments.spec.md` | MISSING | MISSING | CREAR — ALTA PRIORIDAD |
| Disputes | `specs/api/disputes.spec.md` | MISSING | MISSING | CREAR |
| Risk | `specs/api/risk.spec.md` | MISSING | MISSING | CREAR |
| Agents / Orchestration | `specs/api/agents.spec.md` | MISSING | MISSING | CREAR |
| Ops | `specs/api/ops.spec.md` | MISSING | MISSING | CREAR |

---

## NIVEL 5 — Contratos de FSM

| Flujo | Ruta | Estado | Acción |
|---|---|---|---|
| Job lifecycle | `specs/fsm/job-lifecycle.spec.md` | MISSING | CREAR |
| Milestone lifecycle | `specs/fsm/milestone-lifecycle.spec.md` | MISSING | CREAR |
| Payment / Escrow lifecycle | `specs/fsm/payment-lifecycle.spec.md` | MISSING | CREAR — ALTA PRIORIDAD |
| Dispute lifecycle | `specs/fsm/dispute-lifecycle.spec.md` | MISSING | CREAR |
| Agent run lifecycle | `specs/fsm/agent-run-lifecycle.spec.md` | PARTIAL | Referencia ADR-0004 |

---

## NIVEL 6 — Flujos de UI por rol

| Flujo | Ruta | Estado | Acción |
|---|---|---|---|
| Client flows | `specs/ui/client-flows.spec.md` | MISSING | CREAR |
| Professional flows | `specs/ui/pro-flows.spec.md` | MISSING | CREAR |
| Admin / Ops flows | `specs/ui/admin-flows.spec.md` | MISSING | CREAR |

---

## NIVEL 7 — Infraestructura y Seguridad

| Documento | Ruta | Estado |
|---|---|---|
| Security policies | `docs/security/` | PARTIAL |
| BCP / Continuity | `docs/bcp/` | PARTIAL |
| Runbooks | `docs/runbooks/` | PARTIAL |
| Consolidation plan | `docs/consolidation/` | PARTIAL |

---

## Prioridades de creación

### Sprint SDD-1 (ahora)
```
1. specs/api/payments.spec.md       ← flujo más crítico
2. specs/api/milestones.spec.md     ← corazón operativo
3. specs/fsm/payment-lifecycle.spec.md
4. specs/fsm/job-lifecycle.spec.md
5. specs/api/evidence.spec.md
```

### Sprint SDD-2
```
6. specs/api/auth.spec.md
7. specs/api/jobs.spec.md
8. specs/fsm/milestone-lifecycle.spec.md
9. specs/ui/client-flows.spec.md
10. specs/ui/pro-flows.spec.md
```

### Sprint SDD-3
```
11. specs/api/disputes.spec.md
12. specs/api/risk.spec.md
13. specs/api/agents.spec.md
14. specs/fsm/dispute-lifecycle.spec.md
15. specs/ui/admin-flows.spec.md
```

---

## Cómo agregar un spec a este índice

1. Crear el archivo en la ruta correspondiente usando la plantilla en `.specify/templates/`
2. Agregar una línea a la tabla del nivel correspondiente
3. Marcar estado como `DRAFT`
4. Cuando el spec sea revisado y aprobado, cambiar a `APPROVED`
5. Crear o referenciar los tests correspondientes
6. Solo entonces se puede implementar el feature

---

## Score SDD actual

```
Nivel 0 (Gobierno):          3/3   ████████████ 100%
Nivel 1 (Visión):           13/13  ████████████ 100%
Nivel 2 (Dominio):           9/11  ██████████░░  82%
Nivel 3 (ADRs):             11/11  ████████████ 100%
Nivel 4 (API contracts):     0/11  ░░░░░░░░░░░░   0%  ← GAP CRÍTICO
Nivel 5 (FSM specs):         1/5   ██░░░░░░░░░░  20%  ← GAP CRÍTICO
Nivel 6 (UI flows):          0/3   ░░░░░░░░░░░░   0%
Nivel 7 (Infra/Seguridad):   3/3   ████████░░░░  66%

Score global SDD: 40/60 = 67%
```

**El mayor gap está en contratos de API y FSM specs.** Eso explica por qué el código y la arquitectura están desalineados.
