---
version: 2.0.0
fecha: 2026-03-30
estado: canonical
owner: arquitecto-principal
changelog: Actualizado para reflejar estado real post-smoke-test-24/24. Nodos nuevos: ProjectsModule, PolicyRule, Notification, FieldOps completo, AgentCatalog expandido.
---

# 03_NODE_REGISTRY — Inventario de Nodos del Ecosistema

## Propósito

Registro oficial de todos los nodos conocidos del ecosistema SEMSEproject. Cada nodo tiene un estado, un owner, dependencias y una siguiente acción concreta.

## Leyenda de estados

| Estado | Significado |
|---|---|
| `vision` | Solo existe como concepto en documentos |
| `exploring` | En investigación o prototipo experimental |
| `defined` | Especificado, schema y contrato definidos, no implementado |
| `building` | En construcción activa |
| `operative` | Funcionando y verificado en smoke test |
| `consolidated` | Implementado y probado, integrado al tronco |
| `archived` | Absorbido o descontinuado |
| `frozen` | Congelado, no recibe desarrollo |

## Leyenda de tipos

`app` | `package` | `module` | `agent` | `document` | `schema` | `migration` | `workflow` | `infrastructure`

---

## SECCIÓN 1 — Aplicaciones

| nombre | tipo | dominio | estado | owner | depende_de | impacta_a | ruta | siguiente_accion |
|---|---|---|---|---|---|---|---|---|
| `project-manager-app` | app | ecosistema | building | arquitecto | `@semse/db`, `@semse/schemas` | todo | `project-manager-app/` | completar flujo completo, conectar frontend |
| `apps/api` | app | backend | operative | backend-lead | `@semse/db`, `@semse/schemas`, PostgreSQL | `apps/web`, `apps/worker` | `apps/api/` | completar payments real, storage S3 |
| `apps/web` | app | frontend | building | frontend-lead | `@semse/ui`, `@semse/schemas`, `apps/api` | usuarios finales | `apps/web/` | conectar flujo completo a API real |
| `apps/worker` | app | jobs async | operative | backend-lead | PostgreSQL, `apps/api` | AgentRun lifecycle | `apps/worker/` | migrar a BullMQ desde polling HTTP |
| `web-assistant-portal` | app | asistente / ops | transitional | backend-lead | MySQL, Drizzle, Express, tRPC | `project-manager-app` | `app semse/web-assistant-portal/` | migrar lógica al monorepo canónico |
| `semse-control-mvp` | app | ops / control | frozen | — | Next.js 14, SQLite | — | `app semse/semse-control-mvp/` | extraer módulo ops antes de archivar |

---

## SECCIÓN 2 — Packages del Monorepo

| nombre | tipo | dominio | estado | owner | depende_de | impacta_a | ruta | siguiente_accion |
|---|---|---|---|---|---|---|---|---|
| `@semse/db` | package | datos | operative | data-lead | PostgreSQL, Prisma 6 | todos los módulos | `packages/db/` | agregar pgvector en Fase 3 |
| `@semse/schemas` | package | contratos | building | data-lead | Zod 3, `@semse/db` | `apps/api`, `apps/web` | `packages/schemas/` | completar schemas para todos los módulos |
| `@semse/ui` | package | diseño | building | frontend-lead | React, Tailwind, shadcn/ui | `apps/web` | `packages/ui/` | portar componentes críticos desde `src/` |
| `@semse/auth` | package | identidad | defined | backend-lead | JWT, `@semse/db` | `apps/api`, `apps/web` | `packages/auth/` | refresh token + session management |
| `@semse/agents` | package | agentes IA | operative | ai-lead | OpenAI (futuro), BullMQ (futuro) | `apps/api`, `apps/worker` | `packages/agents/` | 16 agentes nombrados + 8 especializados definidos |
| `@semse/shared` | package | utilidades | building | backend-lead | TypeScript | todas las apps | `packages/shared/` | consolidar tipos compartidos |

---

## SECCIÓN 3 — Módulos NestJS (apps/api)

| nombre | tipo | dominio | estado | depende_de | impacta_a | ruta | siguiente_accion |
|---|---|---|---|---|---|---|---|
| `HealthModule` | module | infra | operative | NestJS | CI/CD, monitoreo | `modules/health/` | mantener |
| `AuthModule` | module | identidad | operative | JWT, bcrypt, `@semse/db` | todos los módulos | `modules/auth/` | refresh token, rate limiting |
| `JobsModule` | module | jobs | building | `@semse/db`, `@semse/schemas` | BidsModule, ContractsModule | `modules/jobs/` | filtros búsqueda, estados completos, AuditLog |
| `BidsModule` | module | bids | building | `@semse/db`, JobsModule | ContractsModule, ReservationsModule | `modules/bids/` | lógica selección/rechazo, límite bids por job |
| `ReservationsModule` | module | reservas | building | `@semse/db`, BidsModule | ContractsModule | `modules/reservations/` | timer de expiración (BullMQ Sprint 2.4) |
| `ContractsModule` | module | contratos | building | `@semse/db`, MilestonesModule | PaymentsModule, EvidenceModule | `modules/contracts/` | firma digital completa, estados de contrato |
| `ProjectsModule` | module | proyectos | operative | `@semse/db`, JobsModule | MilestonesModule, EvidenceModule | `modules/projects/` | bridge job→project canónico y estable |
| `MilestonesModule` | module | hitos | operative | `@semse/db`, ContractsModule, PolicyService | EvidenceModule, PaymentsModule | `modules/milestones/` | integrar PolicyService en approve/reject |
| `EvidenceModule` | module | evidencia | building | `@semse/db`, MilestonesModule | PaymentsModule, TrustModule | `modules/evidence/` | integrar S3/R2 real, pre-sign URLs |
| `PaymentsModule` | module | pagos | building | `@semse/db`, escrow logic, ContractsModule | DisputesModule, TrustModule | `modules/payments/` | integrar payment provider real (Stripe/Conekta) |
| `DisputesModule` | module | disputas | building | `@semse/db`, PaymentsModule, EvidenceModule | TrustModule, OpsModule | `modules/disputes/` | flujo completo: assign, review, resolve |
| `TrustModule` | module | confianza | building | `@semse/db`, ratings, evidence scoring | rankings, fraud | `modules/trust/` | mejorar cálculo con señales reales post-job |
| `FieldOpsModule` | module | operaciones campo | operative | `@semse/db`, MilestonesModule | OpsModule, EvidenceModule | `modules/field-ops/` | integrar KnowledgeFact con agentes |
| `AgentsModule` | module | agentes IA | operative | `@semse/agents`, `@semse/db`, AuditService | todos los dominios | `modules/agents/` | conectar LLM real, activar ejecutores |
| `OpsModule` | module | auditoría | operative | `@semse/db`, AuditService, TrustService | todos los módulos | `modules/ops/` | dashboard en tiempo real, métricas |

---

## SECCIÓN 4 — Infraestructura

| nombre | tipo | dominio | estado | depende_de | impacta_a | ruta | siguiente_accion |
|---|---|---|---|---|---|---|---|
| `AuditService` | infrastructure | auditoría | operative | PrismaService, `AuditLog` model | todos los módulos | `apps/api/src/infrastructure/audit/` | mantener — punto central de trazabilidad |
| `PrismaService` | infrastructure | datos | operative | PostgreSQL, Prisma 6 | todos los módulos | `apps/api/src/infrastructure/prisma/` | mantener |
| `ActorContextService` | infrastructure | identidad | operative | PrismaService | todos los servicios | `apps/api/src/infrastructure/persistence/` | mantener |
| `AuthGuard` (global) | infrastructure | auth | operative | JWT, Reflector, `@Public()` | todos los endpoints | `apps/api/src/common/auth.guard.ts` | mantener |
| `RbacGuard` (global) | infrastructure | permisos | operative | Reflector, `rbac.ts`, `@RequirePermissions()` | endpoints protegidos | `apps/api/src/common/rbac.guard.ts` | unificar permisos con seed |
| `PolicyRule` model | infrastructure | reglas de negocio | defined | `@semse/db` | jobs, milestones, payments, disputes | schema.prisma | crear PolicyService e integrarlo en flujos |
| `Notification` model | infrastructure | notificaciones | defined | `@semse/db`, User | usuarios, mobile, email | schema.prisma | crear NotificationService, disparadores |
| Redis | infrastructure | caché / queues | defined | Docker | worker, sessions, BullMQ | `infra/` | provisionar para BullMQ y rate limiting |
| `PaymentProviderRegistry` | infrastructure | pagos | building | mock provider activo | PaymentsModule | `modules/payments/providers/` | añadir provider real (Stripe o Conekta) |
| `operator_identity` | infrastructure | operacion asistida | defined | credenciales, configuracion persistente, memoria transversal | continuidad operativa del ecosistema | entorno del operador | formalizar fronteras y politicas de retencion |
| `workspace_memory` | infrastructure | operacion asistida | defined | estado contextual de workspace | `agents/`, operacion por repositorio | workspaces del operador | modelar como activo del sistema vivo |
| `agent_runtime` | infrastructure | operacion asistida | defined | bundles locales, runtimes versionados, sandboxes | ejecucion agentic local | entorno del operador | separar runtime recreable de memoria institucional |
| `ephemeral_runtime_state` | infrastructure | operacion asistida | operative | cache, logs, staging temporal | performance y soporte operativo | entorno del operador | mantener purgable y no canonico |
| `backup_recovery` | infrastructure | operacion asistida | operative | snapshots validados | resiliencia y recuperacion | medios externos validados | mantener como capa fria, no activa |

---

## SECCIÓN 5 — Agentes IA

### Agentes Nombrados (interfaz conversacional)

| nombre | rol | estado | contexto_trigger | siguiente_accion |
|---|---|---|---|---|
| SEMSE (assistant) | Asistente central | defined | dashboard, marketplace, jobs | activar con OpenAI |
| Marta | Gestión milestones | defined | milestones, projects, contracts | activar con OpenAI |
| Planner | Planificación y estimaciones | defined | jobs/new, proposals, bids | activar con OpenAI |
| Felix | Soporte técnico de campo | defined | units, evidence, worklogs | activar con OpenAI |
| Escrow | Pagos y escrow | defined | escrow, payments, milestones | activar con OpenAI |
| Justus | Contratos y legal | defined | contracts, legal | activar con OpenAI |
| Vesper | Análisis de riesgo | defined | trust, disputes, professionals | activar con OpenAI |
| Evidence Coach | Guía de evidencia | defined | evidence, milestones | activar con OpenAI |

(8 agentes nombrados adicionales: Legal, Security, Pulse, Binary, Tech, Design, Marketing, Health — misma prioridad)

### Agentes Especializados (backend workers)

| nombre | rol | estado | trigger | siguiente_accion |
|---|---|---|---|---|
| Pricing Agent | pricing | defined | nuevo job publicado | implementar en Sprint 3.1 |
| Job Planner Agent | job-planner | defined | scope creation | implementar en Sprint 3.2 |
| Trust Match Agent | trust-match | defined | matching profesional | implementar en Sprint 3.2 |
| Evidence Coach Agent | evidence-coach | defined | milestone evidence upload | implementar en Sprint 3.3 |
| Risk Assessment Agent | risk | defined | payment, contract, fraud signal | implementar en Sprint 3.4 |
| Dispute Resolution Agent | dispute | defined | disputa abierta | implementar en Sprint 3.5 (HITL obligatorio) |
| Orchestrator | orchestrator | defined | multi-agent tasks | implementar en Sprint 3.6 |
| ECV (Ethical Constitutional Validator) | ecv | defined | agent output validation | implementar en Sprint 3.6 |

---

## SECCIÓN 6 — Schemas y migraciones

| nombre | tipo | dominio | estado | depende_de | impacta_a | siguiente_accion |
|---|---|---|---|---|---|---|
| `schema.prisma` | schema | datos | operative | PostgreSQL | todas las apps | agregar: pgvector extension (Fase 3) |
| `20260309205333_init` | migration | base | operative | schema.prisma | todos los modelos base | aplicada |
| `20260310045500_dispute_assignment_fields` | migration | disputas | operative | schema.prisma | DisputesModule | aplicada |
| `20260310052000_agent_run_lifecycle_fields` | migration | agentes | operative | schema.prisma | AgentsModule | aplicada |
| `20260312160000_job_reservations_contracts_transition` | migration | jobs/reservations | operative | schema.prisma | JobsModule, ReservationsModule | aplicada |
| `20260312190000_payment_escrow_job_contract_link` | migration | pagos | operative | schema.prisma | PaymentsModule | aplicada |
| `20260313183000_bid_professional_user_bridge` | migration | bids | operative | schema.prisma | BidsModule | aplicada |
| `migration_pending_pgvector` | migration | agentes / RAG | defined | pgvector extension | MatchingAgent, knowledge | crear en Fase 3 |
| `migration_pending_user_profile` | migration | identidad | defined | schema.prisma | UserProfile embedding | crear en Fase 3 |
| `migration_pending_agent_memory` | migration | agentes | defined | schema.prisma | AgentMemory | crear en Fase 3 |

---

## SECCIÓN 7 — Workflows de negocio

| nombre | tipo | dominio | estado | depende_de | impacta_a | siguiente_accion |
|---|---|---|---|---|---|---|
| `flujo-canonico-trabajo` | workflow | jobs | building | jobs→bids→reservations→contracts→milestones→evidence→payments | todos los módulos | implementar de punta a punta en Sprint 2.2 |
| `expiracion-reservas` | workflow | reservations | defined | ReservationsModule, worker/BullMQ | estados de jobs, bids | implementar en Sprint 2.4 |
| `funding-escrow` | workflow | payments | building | PaymentsModule, ContractsModule | liberación de fondos | mock funcional, provider real en Sprint 2.3 |
| `aprobacion-hito` | workflow | milestones | operative | MilestonesModule, EvidenceModule, PaymentsModule | ratings, disputas | policy + notificación en Sprint 2.2 |
| `disputa-basica` | workflow | disputes | building | DisputesModule, EvidenceModule, PaymentsModule | TrustModule, OpsModule | completar flujo en Sprint 2.3 |
| `trust-recalculo` | workflow | trust | defined | TrustModule, PaymentsModule, RatingModule | TrustScore por actor | implementar en Sprint 2.5 |
| `agent-run-lifecycle` | workflow | agentes | operative | AgentsModule, worker, AuditService | AgentRun states | mejorar con BullMQ en Sprint 2.4 |
| `policy-evaluation` | workflow | reglas | defined | PolicyRule, PolicyService | jobs, milestones, payments | implementar PolicyService en Sprint 2.2 |
| `notification-dispatch` | workflow | notificaciones | defined | Notification model, NotificationService | usuarios | implementar en Sprint 2.5 |

---

## SECCIÓN 8 — Documentos canónicos

| nombre | tipo | estado | siguiente_accion |
|---|---|---|---|
| `01_KERNEL.md` | document | canonical | Actualizado 2026-03-30 |
| `02_AUTHORITY_MAP.md` | document | canonical | Actualizado 2026-03-30 |
| `03_NODE_REGISTRY.md` | document | canonical | Actualizado 2026-03-30 |
| `04_AGENTIC_LAYER.md` | document | canonical | Actualizar con catálogo real al iniciar Fase 3 |
| `05_DATA_ARCHITECTURE.md` | document | canonical | Actualizar schema a v2 completo |
| `06_EXECUTION_ROADMAP.md` | document | canonical | Actualizar fases con estado real |
| `07_SELF_IMPROVING_AGENTS.md` | document | canonical | Mantener — aplica en Fase 3 |
| `08_SPRINT_BACKLOG.md` | document | canonical | Nuevo — backlog priorizado activo |
| `SEMSE_MARCO_MAESTRO_EXPANDIDO_2026-03-30.md` | document | canonical | Constitución soberana — no modificar |
| `modelo_capa_operacion_asistida_semse_2026-04-12.md` | document | reference | usar como referencia absorbida del subsistema agentic |
| `destilacion_capa_operacion_asistida_labsemse_2026-04-12.md` | document | evidence | mantener como trazabilidad de análisis y ejecución |
