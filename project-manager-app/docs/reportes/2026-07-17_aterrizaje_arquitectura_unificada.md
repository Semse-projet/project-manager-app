# Aterrizaje de la arquitectura unificada SEMSE en el repo actual

**Fecha:** 2026-07-17  
**Repo:** `Semse-projet/project-manager-app`  
**Corte base:** `main@bd881e5` (post-merge del PR #329)  
**Metodología:** mapeo de los 10 pilares de la arquitectura unificada contra modelos Prisma, módulos NestJS, paquetes compartidos, web routes y workers.

## Resumen ejecutivo

El repositorio ya contiene la mayoría de los componentes que la arquitectura unificada describe, pero organizados como un **monolito modular con muchos módulos verticales** en lugar de una sola capa homogénea. La gran fortaleza es que `CURRENT_ARCHITECTURE.md` y `SEMSE_CONNECT_TAXONOMY.md` ya consolidan 9 dominios oficiales y una jerarquía de fuentes de verdad. La principal oportunidad es reducir la **duplicación semántica** detectada en mensajería, tareas, documentos, tracking de tiempo y señales de inteligencia.

## Estadísticas del repositorio

| Capa | Cantidad | Notas |
|---|---|---|
| Modelos Prisma | 139 | `packages/db/prisma/schema.prisma` |
| Módulos API | 64 | `apps/api/src/modules/` |
| Paquetes compartidos | 11 | `packages/` |
| Rutas top-level web | 33 | `apps/web/app/` |
| Worker handlers | 5 | `apps/worker/src/` |

## 1. Núcleo de identidad y organizaciones

**Estado:** IMPLEMENTADO en su mayoría.

| Entidad unificada | Modelos Prisma existentes | Módulos API |
|---|---|---|
| users | `User`, `UserProfile`, `AuthSession`, `PasswordResetToken` | `auth`, `users` |
| organizations | `Tenant`, `Org` | `organizations` |
| roles/permissions | `Role`, `Permission`, `RolePermission` | `auth` |
| memberships | `Membership` | `organizations`, `worker-verification` |
| invitations | - (usa `Membership`/invitación por flujo) | `auth` |
| audit events | `AuditLog` | transversal (`@RequirePermissions` + `AuditService`) |

**Observaciones:**
- `organization_id`/`tenantId` está presente en la mayoría de modelos; sin embargo, la migración reciente #327 fue necesaria porque el contrato Prisma tenía inconsistencias acumuladas.
- `Tenant` y `Org` conviven; la taxonomía vigente los trata como conceptos distintos. No es una duplicación grave, pero requiere documentar el ownership.

## 2. Núcleo de datos compartido

**Estado:** PARCIAL. Hay muchas entidades centrales, pero dispersas por vertical.

| Entidad unificada | Modelos existentes | Estado |
|---|---|---|
| contacts/companies | `ContactIdentity`, `Vendor`, `ContractorLead` | PARCIAL; no hay `contacts` canónico |
| projects/cases | `Project`, `Job`, `BuildOpsProject`, `AgroFarm`, `AgroProductionCycle` | Disperso por vertical |
| tasks | `JobTask`, `BuildOpsTask`, `AgroFarmTask`, `tasks` genéricos | **DUPLICACIÓN** |
| documents | `Evidence`, `PrometeoDocument`, `DocumentTemplate`, `ComplianceDoc`, `AgroEvidenceItem`, `MilestoneEvidenceItem` | **DUPLICACIÓN** |
| communications | `MessageThread`, `Message`, `ConversationThread`, `ConversationMessage`, `OutboundDelivery` | **DUPLICACIÓN** |
| events | `DomainOutboxEvent`, `DomainEventConsumption`, `ProductEvent` | Existe outbox; falta calendario/recordatorios unificado |
| tags/custom_fields/relationships | No presentes como modelo transversal | FALTANTE |

**Hallazgo clave:** la arquitectura unificada pide un solo repositorio documental y una sola bandeja de comunicaciones. Hoy SEMSE tiene múltiples tablas de mensajes y documentos por vertical (evidence, Prometeo, Agro, BuildOps).

## 3. Motor de procesos

**Estado:** PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| process_definitions | `BuildOpsPlanVersion`, `ProjectDraft`, `ProjectIntake`, `ChangeOrderCandidate` | PARCIAL; esquemas pero sin motor genérico |
| process_instances | `AgentRun`, `MissionControlIncident`, `AlgorithmRun` | PARCIAL (hay ejecuciones, no instancias de proceso común) |
| stages/transitions/approvals | FSMs por dominio en `docs/foundation/STATE_MACHINES.md` | PARCIAL; no hay motor de workflow unificado |
| service_level_policies | `PolicyRule`, `RiskScore`, `ProjectRiskScore` | PARCIAL |

**Observación:** los procesos están cableados verticalmente (milestones, jobs, buildops). Faltan `process_definitions` e `instancia de proceso` genéricos como pide la arquitectura unificada. `STATE_MACHINES.md` y `EVENT_CATALOG.md` son buenas bases, pero no se ejecutan a través de un motor central.

## 4. Motor de automatización

**Estado:** PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| trigger → conditions → actions | `Automation` no es un módulo propio; la lógica vive en `agents`, `autonomy`, `product-intelligence` y workers | FALTANTE como motor explícito |
| automation_definitions/runs | `AgentRun`, `AutonomousPrRun`, `PermanentLoopState`, `ProductIngestBatch` | **DUPLICACIÓN** de conceptos de ejecución programada |
| scheduled_jobs | `scheduled-jobs` en worker, `crons` en autonomy | PARCIAL |
| webhook_endpoints | `evidence-gateway`, `communications` (WhatsApp), `lender-webhook` | PARCIAL; adaptadores dispersos |

**Hallazgo:** hay muchos "motores" de ejecución (Prometeo, Autonomy, Product Intelligence, Permanent Loops) pero no una abstracción común `automation_definitions → runs → logs`.

## 5. Capa de inteligencia y agentes

**Estado:** IMPLEMENTADO/PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| orquestador de agentes | `prometeo`, `agents`, `semse-agents` | IMPLEMENTADO; Prometeo Runtime P2 desplegado |
| herramientas autorizadas | `prometeo-tool-registry.ts` (23 read, 7 write) | PARCIAL; faltan adaptadores y policy central |
| tool_permissions | `permissions: [...]` en cada tool; RBAC default-deny | PARCIAL |
| prompts/knowledge sources | `knowledge`, `repo-knowledge`, `runtime-knowledge`, `skills` | IMPLEMENTADO/PARCIAL |
| human_approvals | `AgentApproval`, `MissionControlIncident` | PARCIAL |
| agent_runs | `AgentRun`, `AgentDecision`, `AutonomousPrRun`, `AlgorithmRun`, `BrowserMission` | **DUPLICACIÓN** de tablas de ejecución |

**Observación:** la arquitectura unificada exige que los agentes usen las mismas APIs de dominio. Esto **ya está en `CURRENT_ARCHITECTURA.md`**: Prometeo no sustituye módulos de dominio. Sin embargo, modelos como `AgentRun`, `AutonomousPrRun`, `BrowserMission`, `AlgorithmRun` y `ProductIngestBatch` representan conceptos similares de ejecución sin una entidad común.

## 6. Documentos y conocimiento

**Estado:** PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| documents | `Evidence`, `PrometeoDocument`, `PrometeoAsset`, `DocumentTemplate`, `ComplianceDoc`, `AgroEvidenceItem`, `MilestoneEvidenceItem`, `WorkOrder` | **DUPLICACIÓN** |
| document_versions | `Evidence` tiene metadata/versionado parcial | PARCIAL |
| document_templates | `DocumentTemplate` | IMPLEMENTADO |
| knowledge_collections/chunks | `KnowledgeFact`, `WorkspaceMemoryEntry`, `DocumentChunk`, `PrometeoChunkFeedback` | IMPLEMENTADO/PARCIAL |
| classification/extraction | `VisionAnalysis`, `AiInteractionLog` | PARCIAL |
| permissions | RBAC + ownership por `tenantId` | IMPLEMENTADO |

**Hallazgo:** `Evidence` es el documento canónico para BuildOps/Connect, pero Prometeo, Agro y Compliance mantienen tablas propias. La arquitectura unificada pide un repositorio documental único.

## 7. Comunicaciones omnicanal

**Estado:** PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| communication_threads | `MessageThread`, `ConversationThread` | **DUPLICACIÓN** |
| communications | `Message`, `ConversationMessage` | **DUPLICACIÓN** |
| participants | implícito en threads | FALTANTE como modelo explícito |
| delivery_events | `OutboundDelivery` | PARCIAL (solo WhatsApp/meta) |
| templates | `CommunicationMessageTemplate` | IMPLEMENTADO |

**Hallazgo:** existen dos esquemas de mensajería (`MessageThread/Message` vs `ConversationThread/ConversationMessage`). La arquitectura unificada pide una sola bandeja operativa.

## 8. Interfaces del producto

**Estado:** IMPLEMENTADO/PARCIAL.

| Interfaz unificada | Implementación actual | Estado |
|---|---|---|
| Portal interno | `apps/web/app/(app)/*`, `/admin/*`, `/pro/*` | IMPLEMENTADO |
| Portal externo | landing, `/login`, `/register`, `/client/*`, `/worker/*` | IMPLEMENTADO/PARCIAL |
| Interfaz conversacional | Prometeo Workspace, `assistant`, `cortex` | PARCIAL |

**Observación:** las interfaces existen, pero la web BFF (`/app/api/semse/*`) está fragmentada por módulo. No hay una API unificada de "registros" o "procesos" como pide la arquitectura unificada.

## 9. Integraciones

**Estado:** IMPLEMENTADO/PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| integration_accounts | `StripeConnectAccount`, `CommunicationChannelAccount` | PARCIAL |
| integration_credentials | `SatelliteToken`, secretos por env | IMPLEMENTADO |
| integration_mappings | `domain-events`, `satellites` specs | PARCIAL |
| external_objects | `ProductEvent`, `ProductIngestBatch`, `VisionAnalysis` | PARCIAL |
| webhook_events | `evidence-gateway`, `lender-webhook`, WhatsApp webhook | PARCIAL; adaptadores verticales |

**Hallazgo:** hay adaptadores para Stripe, WhatsApp, Ollama/OpenAI/Anthropic, Vision y Railway, pero no una capa de conectores normalizada con `adapter → modelo SEMSE → servicio de dominio` como pide la arquitectura unificada.

## 10. Analítica y observabilidad

**Estado:** PARCIAL.

| Componente unificado | Implementación actual | Estado |
|---|---|---|
| eventos del producto | `ProductEvent`, `ProductSession`, `ProductIngestBatch` | IMPLEMENTADO/PARCIAL |
| ejecuciones de procesos | `AgentRun`, `AutonomousPrRun`, `AlgorithmRun` | PARCIAL |
| automatizaciones | logs en worker + `Automation` no central | FALTANTE |
| uso de agentes | `AiInteractionLog`, `AgentRun` | PARCIAL |
| errores/latencia/costos | `MissionControlIncident`, `OperationalSignal`, `FrictionSignal`, `ProductIntelligence` | PARCIAL |
| auditoría | `AuditLog` | IMPLEMENTADO |

**Hallazgo:** la separación entre datos transaccionales, eventos analíticos, logs técnicos y auditoría no es explícita. `ProductIntelligence` y `MissionControl` avanzan, pero faltan SLOs de negocio y traces unificados.

---

## Duplicaciones y violaciones de arquitectura detectadas

| Problema | Evidencia | Severidad |
|---|---|---|
| Múltiples tablas de tareas | `JobTask`, `BuildOpsTask`, `AgroFarmTask`, `tasks` | Alta |
| Múltiples tablas de mensajes | `MessageThread/Message`, `ConversationThread/ConversationMessage` | Alta |
| Múltiples repositorios documentales | `Evidence`, `PrometeoDocument`, `AgroEvidenceItem`, `MilestoneEvidenceItem` | Alta |
| Múltiples tracking de tiempo | `WorklogEntry`, `TrackerSession`, `TimeEntry`, `LaborSheet` | Media-Alta |
| Múltiples modelos de ejecución de agentes | `AgentRun`, `AutonomousPrRun`, `BrowserMission`, `AlgorithmRun`, `ProductIngestBatch` | Media |
| Múltiples scoring de riesgo/reputación | `RiskScore`, `ProjectRiskScore`, `Rating`, `trust` | Media |
| Agente/IA con modelos propios vs APIs de dominio | Prometeo usa `tools` y servicios, pero `autonomy` y `product-intelligence` tienen persistencia propia | Media |
| No hay `contacts`/`companies` canónicas | `ContactIdentity`, `Vendor`, `ContractorLead` coexisten | Media |

## Backlog priorizado aterrizado (P0-P3)

### P0 — Inventario y control

- [x] Identificar repositorio y rama principal (`Semse-projet/project-manager-app/main`).
- [x] Catalogar modelos (139), módulos API (64) y paquetes (11).
- [ ] Decidir, por cada duplicación detectada, cuál es el modelo canónico y cuáles son legacy/verticales.
- [ ] Congelar la creación de nuevas tablas de `tasks`, `messages` y `documents` hasta consolidar.

### P1 — Fundaciones

- [ ] Consolidar `contacts`/`companies`/`vendors`/`leads` en un modelo canónico de registro central.
- [ ] Definir `Project`/`Job`/`BuildOpsProject`/`AgroFarm` como proyecciones sobre un caso/proyecto común, o mantenerlos como verticales con límites claros.
- [ ] Crear un `Document` canónico con versiones, links y permisos; reemplazar/evidenciar tablas verticales dispersas.
- [ ] Consolidar `MessageThread` + `ConversationThread` en una sola bandeja `communication_threads`.

### P2 — Procesos y automatización

- [ ] Extraer un `ProcessDefinition`/`ProcessInstance` reutilizable o documentar por qué los FSMs verticales son suficientes.
- [ ] Crear `automation_definitions`/`automation_runs`/`automation_steps` y migrar `AgentRun`/`AutonomousPrRun`/`ProductIngestBatch` como runs de distinto tipo.
- [ ] Consolidar `WorklogEntry`/`TrackerSession`/`TimeEntry` en el Labor Engine (`TimeEntry`/`LaborSheet`) o deprecar los legacy.

### P3 — Inteligencia, integraciones y portal externo

- [ ] Unificar `AgentRun`/`BrowserMission`/`AlgorithmRun`/`ProductIngestBatch` bajo un `agent_run` o `run` común con `type`.
- [ ] Crear capa de conectores (`integration_accounts`/`integration_mappings`/`external_objects`) para Stripe, WhatsApp, modelos y vision.
- [ ] Definir portal externo (`/client/*`, `/worker/*`) como una sola interfaz con permisos de `CLIENT`/`PRO`.

## Conclusiones

El proyecto en Railway **ya es un SEMSE operativo**, no una app local. La arquitectura unificada del attachment se aterriza naturalmente en los 9 dominios de `SEMSE_CONNECT_TAXONOMY.md`. El trabajo principal pendiente no es construir nuevos subsistemas, sino **consolidar las duplicaciones semánticas** que crecieron durante la expansión vertical (tareas, mensajes, documentos, ejecuciones de agentes). La recomendación es no crear más tablas paralelas y, antes de cualquier nuevo feature, mapearlo a uno de los dominios existentes usando el criterio del attachment.

---

## Fuentes consultadas

- `docs/architecture/CURRENT_ARCHITECTURE.md`
- `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`
- `docs/SEMSE_CONNECT_TAXONOMY.md`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/`
- `apps/web/app/`
- `apps/worker/src/`
