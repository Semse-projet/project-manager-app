# SPEC_INDEX — SEMSEproject
**Última actualización:** 2026-05-20 (actualizado: ProTools Master Plan añadido)
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

---

## NIVEL 0 — Constitución y Gobierno

| Documento | Ruta | Estado | Acción |
|---|---|---|---|
| Constitución del proyecto | `.specify/memory/constitution.md` | APPROVED | Leer siempre primero |
| Gobierno SDD | `docs/SDD_GOVERNANCE.md` | APPROVED | Leer antes de cualquier sesión |
| Templates SEMSE | `.specify/templates/overrides/` | APPROVED | Usar para nuevos specs |
| Este índice | `docs/SPEC_INDEX.md` | APPROVED | Actualizar al crear/modificar specs |

---

## NIVEL 1 — Visión y Estrategia

| Documento | Ruta | Estado |
|---|---|---|
| Visión core | `labosemse/vision_core.md` | APPROVED |
| Principios de producto | `labosemse/VISION_PRINCIPLES_FOR_PRODUCT.md` | APPROVED |
| Decisiones bloqueadas | `labosemse/VISION_DECISIONS_LOCKED.md` | APPROVED |
| Glosario canónico | `labosemse/VISION_GLOSSARY.md` | APPROVED |
| Métricas de éxito | `labosemse/VISION_SUCCESS_METRICS.md` | APPROVED |
| Blueprint maestro | `docs/blueprints/` | APPROVED |
| Ecosystem map | `SEMSE_ecosystem_system_map_2026-03-28.md` | APPROVED |

---

## NIVEL 2 — Dominio y Arquitectura

| Documento | Ruta | Estado |
|---|---|---|
| Mapa de dominio | `docs/domain-map.md` | APPROVED |
| Arquitectura general | `docs/architecture.md` | APPROVED |
| Scope MVP | `specs/mvp-scope.md` | APPROVED |
| Entidades canónicas | `specs/entities.md` | APPROVED |
| Workflows core | `specs/SEMSE_CORE_WORKFLOWS.md` | APPROVED |
| Integration map | `docs/specs/integration-map.md` | APPROVED |
| Agents (16 roles) | `AGENTS.md` | APPROVED |
| Checklist absorción | `SEMSE_ABSORPTION_EXECUTION_CHECKLIST.md` | ACTIVE |

---

## NIVEL 3 — Architecture Decision Records (ADRs)

| ADR | Ruta | Estado |
|---|---|---|
| Monorepo shape | `docs/adrs/ADR-0001-monorepo-shape.md` | APPROVED |
| API framework | `docs/adrs/ADR-0002-api-framework.md` | APPROVED |
| Data layer | `docs/adrs/ADR-0003-data-layer.md` | APPROVED |
| Agent run lifecycle | `docs/adrs/ADR-0004-agent-run-lifecycle.md` | APPROVED |
| Core logic isolation | `docs/adrs/ADR-002-core-logic-isolation.md` | APPROVED |
| Explicit FSM modeling | `docs/adrs/ADR-002-explicit-fsm-modeling.md` | APPROVED |
| Async-first heavy workloads | `docs/adrs/ADR-003-async-first-heavy-workloads.md` | APPROVED |
| Auditable internal ledger | `docs/adrs/ADR-003-auditable-internal-ledger.md` | APPROVED |
| Ledger-first payments | `docs/adrs/ADR-003-ledger-first-payments.md` | APPROVED |

---

## NIVEL 4 — Contratos de API

| Dominio | Ruta | Estado | Tests | Gaps documentados |
|---|---|---|---|---|
| Jobs / Marketplace | `docs/specs/api/jobs.spec.md` | APPROVED | MISSING | 8 |
| Milestones | `docs/specs/api/milestones.spec.md` | APPROVED | MISSING | 5 |
| Evidence | `docs/specs/api/evidence.spec.md` | APPROVED | MISSING | 6 |
| Payments / Escrow | `docs/specs/api/payments.spec.md` | APPROVED | MISSING | 7 |
| Disputes | `docs/specs/api/disputes.spec.md` | APPROVED | MISSING | 3 |
| Contracts | `docs/specs/api/contracts.spec.md` | APPROVED | MISSING | 2 |
| BuildOps | `docs/specs/api/buildops.spec.md` | APPROVED | MISSING | 3 |
| Communications | `docs/specs/api/communications.spec.md` | APPROVED | MISSING | 1 (P0) |
| Consciousness / Observer | `docs/specs/api/consciousness.spec.md` | APPROVED | MISSING | 0 |
| Smart Intake | `docs/specs/api/intake.spec.md` | APPROVED | MISSING | 3 |
| Prometeo RAG | `docs/specs/api/prometeo.spec.md` | APPROVED | MISSING | 0 |
| Agents / Orchestration | `docs/specs/api/agents.spec.md` | MISSING | MISSING | — |
| Change Orders | `docs/specs/api/change-orders.spec.md` | MISSING | MISSING | — |
| Matching | `docs/specs/api/matching.spec.md` | MISSING | MISSING | — |
| Reservations | `docs/specs/api/reservations.spec.md` | MISSING | MISSING | — |

---

## NIVEL 5 — Contratos de FSM

| Flujo | Ruta | Estado | Alineado con Prisma |
|---|---|---|---|
| Job lifecycle | `docs/specs/fsm/job-lifecycle.spec.md` | APPROVED | ✅ |
| Milestone lifecycle | `docs/specs/fsm/milestone-lifecycle.spec.md` | APPROVED | ✅ |
| Escrow / Payment lifecycle | `docs/specs/fsm/escrow-lifecycle.spec.md` | APPROVED | ⚠️ Enum faltante en Prisma |
| BuildOps plan lifecycle | `docs/specs/fsm/buildops-lifecycle.spec.md` | APPROVED | ✅ |
| Reservation lifecycle | `docs/specs/fsm/reservation-lifecycle.spec.md` | MISSING | — |
| Agent run lifecycle | `docs/specs/fsm/agent-run-lifecycle.spec.md` | MISSING | — |

---

## NIVEL 6 — Flujos de UI por rol

| Flujo | Ruta | Estado |
|---|---|---|
| Client flows | `docs/specs/ui/client-flows.spec.md` | APPROVED |
| Professional flows | `docs/specs/ui/pro-flows.spec.md` | APPROVED |
| Admin / Ops flows | `docs/specs/ui/admin-flows.spec.md` | APPROVED |
| Smart Intake flow | `docs/specs/ui/intake-flow.spec.md` | APPROVED |

---

## NIVEL 7 — Infraestructura y Seguridad

| Documento | Ruta | Estado |
|---|---|---|
| Security policies | `docs/security/` | PARTIAL |
| BCP / Continuity | `docs/bcp/` | PARTIAL |
| Runbooks | `docs/runbooks/` | PARTIAL |

---

## Gaps P0 — Críticos (Bloquean producción)

| # | Gap | Módulo | Acción |
|---|---|---|---|
| 1 | Webhook WhatsApp sin validación HMAC | `communications/` | IMPLEMENTAR X-Hub-Signature-256 |
| 2 | PRO puede leer financials del escrow | `payments/` | AGREGAR guard de permisos |
| 3 | Milestone submit no valida evidencia | `milestones/` | IMPLEMENTAR guard evidenceCount > 0 |
| 4 | `EscrowStatus` sin enum en Prisma | `payments/` | CREAR enum + migración |

---

## Gaps P1 — Specs faltantes para módulos con código

| # | Módulo | Spec necesario | Complejidad |
|---|---|---|---|
| 1 | `agents/` | `docs/specs/api/agents.spec.md` | Alta |
| 2 | `change-orders/` | `docs/specs/api/change-orders.spec.md` | Media |
| 3 | `matching/` | `docs/specs/api/matching.spec.md` | Alta |
| 4 | `reservations/` | `docs/specs/fsm/reservation-lifecycle.spec.md` | Media |
| 5 | `field-ops/` | `docs/specs/api/field-ops.spec.md` | Media |

---

---

## NIVEL 8 — ProTools Master Plan (Nuevo)

> Plan de desarrollo de las herramientas de estimación. El agente agentico lee estos docs para operar en loop.

| Documento | Ruta | Estado | Descripción |
|---|---|---|---|
| Harness Agentico | `docs/AGENTIC_HARNESS.md` | APPROVED | Manual de vuelo del agente en modo loop |
| Master Plan ProTools | `docs/PROTOOLS_MASTER_PLAN.md` | ACTIVE | 5 fases, 16 módulos, 64 bloques con tracking de estado |
| Spec M1.1 Material Pricing | `docs/specs/tools/fase-1/m1.1-material-pricing.spec.md` | DRAFT | BLS PPI + EstimationPro + FRED + caché Prisma |
| **Arquitectura 6 Agentes** | `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md` | **APPROVED** | Marketplace·BuildOps·ProTools·Evidence·Crowd·Prometeo — fronteras, eventos, tipos, flujo |
| Spec M1.2 Regional Costs | `docs/specs/tools/fase-1/m1.2-regional-costs.spec.md` | MISSING | BLS OEWS + multiplicadores por zip |
| Spec M1.3 Stripe Escrow | `docs/specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | MISSING | Stripe Connect manual payouts |
| Spec M1.4 Contracts | `docs/specs/tools/fase-1/m1.4-contracts.spec.md` | MISSING | HelloSign e-signature |
| Spec M2.1 Lien Rights | `docs/specs/tools/fase-2/m2.1-lien-rights.spec.md` | APPROVED | LienGrid API 50 estados |
| Spec M2.2 Dispute Docs | `docs/specs/tools/fase-2/m2.2-dispute-docs.spec.md` | APPROVED | GPS foto + daily logs + change order trail |
| Spec M2.3 Weather | `docs/specs/tools/fase-2/m2.3-weather.spec.md` | APPROVED | Tomorrow.io alerts |
| Spec M3.1 Proactive Agents | `docs/specs/tools/fase-3/m3.1-proactive-agents.spec.md` | MISSING | 6 agentes de alerta regla-basados |
| Spec M3.2 Extended Metrics | `docs/specs/tools/fase-3/m3.2-extended-metrics.spec.md` | MISSING | Completar 20 trades |
| Spec M3.3 Labor Calibration | `docs/specs/tools/fase-3/m3.3-labor-calibration.spec.md` | MISSING | NECA/PHCC/RSMeans |

---

## NIVEL 9 — SEMSE Agro / FarmOps (Nuevo)

> Vertical agricola propuesta para convertir SEMSEproject en un sistema operativo de finca.
> Estado actual: documentacion y arquitectura. No implementar sin abrir PRs pequenos en el orden definido.

| Documento | Ruta | Estado | Descripcion |
|---|---|---|---|
| Agro execution control | `docs/specs/agro/EXECUTION_CONTROL.md` | APPROVED | Gates, orden de ejecucion y DoD por PR |
| Agro index | `docs/specs/agro/README.md` | APPROVED | Entrada canonica de la carpeta SEMSE Agro |
| Master Spec | `docs/specs/agro/SEMSE_AGRO_MASTER_SPEC.md` | APPROVED | Vision, mercado, arquitectura y fases F0-F5 |
| F1 RanchOps Core | `docs/specs/agro/F1_RANCHOPS_CORE_SPEC.md` | DRAFT | Especificacion ejecutable para MVP ganadero |
| F2-F5 Roadmap | `docs/specs/agro/F2_TO_F5_ROADMAP.md` | DRAFT | Expansion a FarmOps mixto, confianza, riesgo y marketplace |
| Prompt Library | `docs/specs/agro/IMPLEMENTATION_PROMPTS.md` | DRAFT | Prompts de implementacion y revision por PR |
| Railway Recovery Runbook | `docs/specs/agro/RAILWAY_GREEN_RECOVERY_RUNBOOK.md` | DRAFT | Runbook para recuperar build/deploy sin meter features |

Regla:

```txt
SEMSE Agro no es fork.
SEMSE Agro no se implementa completo de una vez.
Railway green recovery precede cualquier feature Agro si el deploy esta roto.
F1 RanchOps Core debe estabilizarse antes de F2-F5.
```

---

## Score SDD actual

```
Nivel 0 (Gobierno):          4/4   ████████████ 100%
Nivel 1 (Visión):            7/7   ████████████ 100%
Nivel 2 (Dominio):           8/8   ████████████ 100%
Nivel 3 (ADRs):              9/9   ████████████ 100%
Nivel 4 (API contracts):    11/15  █████████░░░  73%  ← 4 MISSING
Nivel 5 (FSM specs):         4/6   ████████░░░░  67%  ← 2 MISSING
Nivel 6 (UI flows):          4/4   ████████████ 100%
Nivel 7 (Infra/Seguridad):   3/3   ████████████ 100%

Score global SDD: 50/56 = 89%

Gaps P0 cerrados:  1/4  (25%)  ← PRÓXIMO FOCO
Gaps P1 cerrados:  0/5  (0%)   ← DESPUÉS DE P0
```
