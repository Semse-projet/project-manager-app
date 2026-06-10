# SPEC_INDEX — SEMSEproject
**Última actualización:** 2026-05-24 (matriz SDD generada por `pnpm spec:index`)
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

<!-- SPEC_INDEX:START -->
## Matriz SDD Generada

> Bloque generado por `pnpm spec:index`. Editar metadata en cada spec, no esta tabla.

| Spec ID | Domain | Status | Risk | API | UI | Tests | Related Files | Last Verified |
|---|---|---|---|---|---|---|---|---|
| [semse-agent-architecture](docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md) | agents | VERIFIED | high | yes | no | yes | 5 | 2026-06-09 |
| [api-agents-runtime](docs/specs/api/agents.spec.md) | agents | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [api-buildops](docs/specs/api/buildops.spec.md) | buildops | VERIFIED | high | yes | yes | yes | 3 | 2026-06-09 |
| [api-change-orders](docs/specs/api/change-orders.spec.md) | change-orders | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [api-communications](docs/specs/api/communications.spec.md) | communications | VERIFIED | high | yes | no | yes | 2 | 2026-06-07 |
| [api-consciousness-observer](docs/specs/api/consciousness.spec.md) | ops | VERIFIED | medium | yes | yes | yes | 3 | 2026-06-09 |
| [api-contract-lifecycle](docs/specs/api/contracts.spec.md) | contracts | VERIFIED | high | yes | no | yes | 2 | 2026-06-09 |
| [api-dispute-lifecycle](docs/specs/api/disputes.spec.md) | disputes | VERIFIED | critical | yes | no | yes | 2 | 2026-06-09 |
| [api-evidence-upload-review](docs/specs/api/evidence.spec.md) | evidence | VERIFIED | critical | yes | no | yes | 3 | 2026-06-09 |
| [api-field-ops](docs/specs/api/field-ops.spec.md) | field-ops | VERIFIED | high | yes | no | yes | 2 | 2026-06-07 |
| [api-smart-intake](docs/specs/api/intake.spec.md) | smart-intake | VERIFIED | medium | yes | yes | yes | 3 | 2026-06-09 |
| [api-job-lifecycle-bids](docs/specs/api/jobs.spec.md) | jobs | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [api-matching](docs/specs/api/matching.spec.md) | matching | VERIFIED | high | yes | no | yes | 2 | 2026-06-07 |
| [api-milestone-lifecycle](docs/specs/api/milestones.spec.md) | milestones | VERIFIED | critical | yes | yes | yes | 3 | 2026-06-07 |
| [api-payments-escrow](docs/specs/api/payments.spec.md) | payments | VERIFIED | critical | yes | no | yes | 4 | 2026-06-09 |
| [api-prometeo-rag-trade-knowledge](docs/specs/api/prometeo.spec.md) | prometeo | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [api-reservations](docs/specs/api/reservations.spec.md) | reservations | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [fsm-agent-run-lifecycle](docs/specs/fsm/agent-run-lifecycle.spec.md) | agents | VERIFIED | high | yes | no | yes | 2 | 2026-06-09 |
| [fsm-buildops-plan-lifecycle](docs/specs/fsm/buildops-lifecycle.spec.md) | buildops | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [fsm-escrow-lifecycle](docs/specs/fsm/escrow-lifecycle.spec.md) | payments | VERIFIED | critical | yes | no | yes | 3 | 2026-06-09 |
| [fsm-job-lifecycle](docs/specs/fsm/job-lifecycle.spec.md) | jobs | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [fsm-milestone-lifecycle](docs/specs/fsm/milestone-lifecycle.spec.md) | milestones | VERIFIED | critical | yes | no | yes | 3 | 2026-06-09 |
| [fsm-reservation-lifecycle](docs/specs/fsm/reservation-lifecycle.spec.md) | reservations | VERIFIED | high | yes | no | yes | 2 | 2026-06-09 |
| [m1-1-material-pricing](docs/specs/tools/fase-1/m1.1-material-pricing.spec.md) | tools | VERIFIED | medium | yes | no | yes | 4 | 2026-06-09 |
| [m1-2-regional-costs](docs/specs/tools/fase-1/m1.2-regional-costs.spec.md) | tools | VERIFIED | medium | yes | no | yes | 4 | 2026-06-09 |
| [m1-3-stripe-escrow](docs/specs/tools/fase-1/m1.3-stripe-escrow.spec.md) | payments | VERIFIED | critical | yes | no | yes | 4 | 2026-06-09 |
| [m1-4-contracts](docs/specs/tools/fase-1/m1.4-contracts.spec.md) | contracts | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m2-1-lien-rights](docs/specs/tools/fase-2/m2.1-lien-rights.spec.md) | tools | VERIFIED | critical | yes | no | yes | 3 | 2026-06-09 |
| [m2-2-dispute-docs](docs/specs/tools/fase-2/m2.2-dispute-docs.spec.md) | evidence | VERIFIED | critical | yes | no | yes | 4 | 2026-06-09 |
| [m2-3-weather](docs/specs/tools/fase-2/m2.3-weather.spec.md) | tools | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m3-1-proactive-agents](docs/specs/tools/fase-3/m3.1-proactive-agents.spec.md) | agents | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m3-2-extended-metrics](docs/specs/tools/fase-3/m3.2-extended-metrics.spec.md) | tools | VERIFIED | medium | yes | no | yes | 3 | 2026-06-09 |
| [m3-3-labor-calibration](docs/specs/tools/fase-3/m3.3-labor-calibration.spec.md) | tools | VERIFIED | medium | yes | no | yes | 3 | 2026-06-09 |
| [m4-1-accounting](docs/specs/tools/fase-4/m4.1-accounting.spec.md) | tools | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m4-2-geo-permits](docs/specs/tools/fase-4/m4.2-geo-permits.spec.md) | tools | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m4-3-field-comms](docs/specs/tools/fase-4/m4.3-field-comms.spec.md) | communications | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m5-1-ml-risk](docs/specs/tools/fase-5/m5.1-ml-risk.spec.md) | tools | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m5-2-public-api](docs/specs/tools/fase-5/m5.2-public-api.spec.md) | api | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [m5-3-monetization](docs/specs/tools/fase-5/m5.3-monetization.spec.md) | tools | VERIFIED | high | yes | no | yes | 3 | 2026-06-09 |
| [ui-admin-flows](docs/specs/ui/admin-flows.spec.md) | ui | VERIFIED | high | yes | yes | yes | 3 | 2026-06-09 |
| [ui-client-flows](docs/specs/ui/client-flows.spec.md) | ui | VERIFIED | high | yes | yes | yes | 4 | 2026-06-09 |
| [ui-smart-intake-flow](docs/specs/ui/intake-flow.spec.md) | ui | VERIFIED | medium | yes | yes | yes | 3 | 2026-06-09 |
| [ui-pro-flows](docs/specs/ui/pro-flows.spec.md) | ui | VERIFIED | high | yes | yes | yes | 4 | 2026-06-09 |
| [ui-public-landing-operational-entry](docs/specs/ui/public-landing-operational-entry.spec.md) | ui | APPROVED | missing | yes | yes | yes | 6 | missing |
| [ui-work-os-navigation-decision-intelligence](docs/specs/ui/work-os-navigation-decision-intelligence.spec.md) | ui | VERIFIED | high | yes | yes | yes | 5 | 2026-06-09 |

<!-- SPEC_INDEX:END -->









































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
| Jobs / Marketplace | `docs/specs/api/jobs.spec.md` | VERIFIED | LINKED | 8 |
| Milestones | `docs/specs/api/milestones.spec.md` | VERIFIED | LINKED | 5 |
| Evidence | `docs/specs/api/evidence.spec.md` | VERIFIED | LINKED | 6 |
| Payments / Escrow | `docs/specs/api/payments.spec.md` | VERIFIED | LINKED | 7 |
| Disputes | `docs/specs/api/disputes.spec.md` | APPROVED | LINKED | 3 |
| Contracts | `docs/specs/api/contracts.spec.md` | APPROVED | LINKED | 2 |
| BuildOps | `docs/specs/api/buildops.spec.md` | APPROVED | LINKED | 3 |
| Communications | `docs/specs/api/communications.spec.md` | APPROVED | LINKED | 1 (P0) |
| Consciousness / Observer | `docs/specs/api/consciousness.spec.md` | APPROVED | LINKED | 0 |
| Smart Intake | `docs/specs/api/intake.spec.md` | APPROVED | LINKED | 3 |
| Prometeo RAG | `docs/specs/api/prometeo.spec.md` | APPROVED | LINKED | 0 |
| Agents / Orchestration | `docs/specs/api/agents.spec.md` | APPROVED | LINKED | needs controller-level lifecycle tests |
| Change Orders | `docs/specs/api/change-orders.spec.md` | VERIFIED | LINKED | controller/RBAC tests complete |
| Matching | `docs/specs/api/matching.spec.md` | VERIFIED | LINKED | controller/RBAC tests complete |
| Reservations | `docs/specs/api/reservations.spec.md` | VERIFIED | LINKED | unit/controller tests complete |
| Field Ops | `docs/specs/api/field-ops.spec.md` | VERIFIED | LINKED | controller/RBAC tests complete |

---

## NIVEL 5 — Contratos de FSM

| Flujo | Ruta | Estado | Alineado con Prisma |
|---|---|---|---|
| Job lifecycle | `docs/specs/fsm/job-lifecycle.spec.md` | VERIFIED | ✅ |
| Milestone lifecycle | `docs/specs/fsm/milestone-lifecycle.spec.md` | VERIFIED | ✅ |
| Escrow / Payment lifecycle | `docs/specs/fsm/escrow-lifecycle.spec.md` | APPROVED | ⚠️ Enum faltante en Prisma |
| BuildOps plan lifecycle | `docs/specs/fsm/buildops-lifecycle.spec.md` | APPROVED | ✅ |
| Reservation lifecycle | `docs/specs/fsm/reservation-lifecycle.spec.md` | APPROVED | N/A — domain-store/repository flow |
| Agent run lifecycle | `docs/specs/fsm/agent-run-lifecycle.spec.md` | APPROVED | ✅ AgentRun-backed |

---

## NIVEL 6 — Flujos de UI por rol

| Flujo | Ruta | Estado |
|---|---|---|
| Client flows | `docs/specs/ui/client-flows.spec.md` | APPROVED |
| Professional flows | `docs/specs/ui/pro-flows.spec.md` | APPROVED |
| Admin / Ops flows | `docs/specs/ui/admin-flows.spec.md` | APPROVED |
| Smart Intake flow | `docs/specs/ui/intake-flow.spec.md` | APPROVED |
| Work OS Navigation + Decision Intelligence | `docs/specs/ui/work-os-navigation-decision-intelligence.spec.md` | APPROVED |

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

| # | Módulo | Spec necesario | Estado |
|---|---|---|---|
| 1 | `agents/` | `docs/specs/api/agents.spec.md` | CERRADO — APPROVED, falta VERIFIED |
| 2 | `change-orders/` | `docs/specs/api/change-orders.spec.md` | CERRADO — VERIFIED |
| 3 | `matching/` | `docs/specs/api/matching.spec.md` | CERRADO — VERIFIED |
| 4 | `reservations/` | `docs/specs/api/reservations.spec.md` + `docs/specs/fsm/reservation-lifecycle.spec.md` | CERRADO — VERIFIED |
| 5 | `field-ops/` | `docs/specs/api/field-ops.spec.md` | CERRADO — VERIFIED |

---

---

## NIVEL 8 — ProTools Master Plan (Nuevo)

> Plan de desarrollo de las herramientas de estimación. El agente agentico lee estos docs para operar en loop.

| Documento | Ruta | Estado | Descripción |
|---|---|---|---|
| Harness Agentico | `docs/AGENTIC_HARNESS.md` | APPROVED | Manual de vuelo del agente en modo loop |
| Master Plan ProTools | `docs/PROTOOLS_MASTER_PLAN.md` | ACTIVE | 5 fases, 16 módulos, 64 bloques con tracking de estado |
| Spec M1.1 Material Pricing | `docs/specs/tools/fase-1/m1.1-material-pricing.spec.md` | APPROVED | BLS PPI + EstimationPro + FRED + caché Prisma |
| **Arquitectura 6 Agentes** | `docs/specs/agents/SEMSE_AGENT_ARCHITECTURE.spec.md` | **APPROVED** | Marketplace·BuildOps·ProTools·Evidence·Crowd·Prometeo — fronteras, eventos, tipos, flujo |
| Spec M1.2 Regional Costs | `docs/specs/tools/fase-1/m1.2-regional-costs.spec.md` | APPROVED | BLS OEWS + multiplicadores por zip |
| Spec M1.3 Stripe Escrow | `docs/specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | APPROVED | Stripe Connect manual payouts |
| Spec M1.4 Contracts | `docs/specs/tools/fase-1/m1.4-contracts.spec.md` | APPROVED | HelloSign e-signature |
| Spec M2.1 Lien Rights | `docs/specs/tools/fase-2/m2.1-lien-rights.spec.md` | APPROVED | LienGrid API 50 estados |
| Spec M2.2 Dispute Docs | `docs/specs/tools/fase-2/m2.2-dispute-docs.spec.md` | APPROVED | GPS foto + daily logs + change order trail |
| Spec M2.3 Weather | `docs/specs/tools/fase-2/m2.3-weather.spec.md` | APPROVED | Tomorrow.io alerts |
| Spec M3.1 Proactive Agents | `docs/specs/tools/fase-3/m3.1-proactive-agents.spec.md` | APPROVED | 6 agentes de alerta regla-basados |
| Spec M3.2 Extended Metrics | `docs/specs/tools/fase-3/m3.2-extended-metrics.spec.md` | APPROVED | Completar 20 trades |
| Spec M3.3 Labor Calibration | `docs/specs/tools/fase-3/m3.3-labor-calibration.spec.md` | APPROVED | NECA/PHCC/RSMeans |
| Spec M4.1 Accounting | `docs/specs/tools/fase-4/m4.1-accounting.spec.md` | APPROVED | QuickBooks/Xero sync |
| Spec M4.2 Geo + Permits | `docs/specs/tools/fase-4/m4.2-geo-permits.spec.md` | APPROVED | Google Maps/OpenGov/Aerial View |
| Spec M4.3 Field Comms | `docs/specs/tools/fase-4/m4.3-field-comms.spec.md` | APPROVED | WhatsApp/SMS/PWA field comms |
| Spec M5.1 ML Risk | `docs/specs/tools/fase-5/m5.1-ml-risk.spec.md` | APPROVED | ProjectOutcome + predictive risk |
| Spec M5.2 Public API | `docs/specs/tools/fase-5/m5.2-public-api.spec.md` | APPROVED | Partner API, webhooks, white-label |
| Spec M5.3 Monetization | `docs/specs/tools/fase-5/m5.3-monetization.spec.md` | APPROVED | Subscription tiers + escrow transaction fee |

Nota: los specs de Fase 2-5 estan `APPROVED` como contratos implementables. Sus bloques del Master Plan siguen `PENDING` hasta que exista codigo, migraciones, credenciales de proveedor y pruebas suficientes para elevarlos a `IMPLEMENTED` o `VERIFIED`.

---

## Score SDD actual

```
Nivel 0 (Gobierno):          4/4   ████████████ 100%
Nivel 1 (Visión):            7/7   ████████████ 100%
Nivel 2 (Dominio):           8/8   ████████████ 100%
Nivel 3 (ADRs):              9/9   ████████████ 100%
Nivel 4 (API contracts):    16/16  ████████████ 100%  ← LINKED, varios faltan VERIFIED
Nivel 5 (FSM specs):         6/6   ████████████ 100%  ← LINKED, varios faltan VERIFIED
Nivel 6 (UI flows):          5/5   ████████████ 100%  ← LINKED, varios faltan VERIFIED
Nivel 7 (Infra/Seguridad):   3/3   ████████████ 100%

Score global SDD: Specs linkeados 100% para niveles 0-7. Verificacion ejecutable: ver bloque generado y `pnpm spec:coverage`.

Gaps P0 cerrados:  1/4  (25%)  ← PRÓXIMO FOCO
Gaps P1 cerrados:  5/5  (100%) ← Specs creados; varios ya están en VERIFIED con pruebas de controller/RBAC
```
