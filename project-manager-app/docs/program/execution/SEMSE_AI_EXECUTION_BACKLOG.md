# SEMSE AI Execution Backlog

## 1. Objetivo

Convertir la capa de IA de SEMSE en una capacidad operativa real sobre el monorepo canónico:

- repo técnico: `/home/yoni/labsemse/project-manager-app`
- runtime actual: `AgentRun` + `AgentsModule` + worker polling
- base de eventos ya existente: `packages/schemas/src/domain-events.schema.ts`

La meta no es agregar más agentes nominales.
La meta es volver útil la inteligencia en el flujo real de jobs, milestones, evidencia, pagos, riesgo y disputas.

---

## 2. Estado útil ya confirmado

Ya existe:

- catálogo de agentes en `packages/agents/src/index.ts`
- `AgentRun` en Prisma
- `AgentsModule` en API
- worker polling en `apps/worker/src/main.mjs`
- `TrustService`
- esquemas de eventos de dominio con triggers
- auditoría de `AgentRun`

Todavía falta:

- ejecución real por agente especializado;
- enrutamiento por eventos hacia `AgentRun`;
- memoria operativa por entidad;
- validación constitucional (`ecv`) antes de acciones sensibles;
- integración de outputs al dominio;
- métricas de impacto por agente.

---

## 3. Orden correcto de implementación

### Ola 1 — IA útil inmediata

Implementar primero:

1. `job-planner`
2. `pricing`
3. `evidence-coach`
4. `risk`

Razon:

- mejoran el flujo central;
- reducen ambigüedad y retrabajo;
- no exigen autonomía peligrosa;
- permiten medir valor rápido.

### Ola 2 — IA de control y confianza

Implementar después:

1. `trust-match`
2. `ops summarizer`
3. `alert prioritization`
4. recomputación explicable de trust

### Ola 3 — Orquestación y gobernanza

Implementar después:

1. `orchestrator`
2. `ecv`
3. policy gates por acción sensible

---

## 4. Épicas técnicas

## Épica 0 — Operacion Asistida como capacidad base

Objetivo:
Formalizar la capa de operacion asistida dentro del monorepo para que identidad operativa, memoria de workspace, runtime, estado efímero y respaldo dejen de existir como práctica implícita y pasen a ser capacidad modelada.

### Tickets

1. Definir `OperatorContext` técnico separado de auth de usuario final.
2. Diseñar `WorkspaceMemory` como dominio explícito sobre `knowledge`.
3. Separar `agent_runtime` de `catalog` y `memory` en `packages/agents` y `packages/autonomy`.
4. Crear política operativa para `ephemeral_runtime_state`.
5. Integrar runbooks de `backup_recovery` dentro de BCP y Ops.
6. Publicar mapa de trazabilidad y ownership por subcapa.

### Rutas objetivo

- `packages/auth/`
- `packages/knowledge/`
- `packages/agents/`
- `packages/autonomy/`
- `apps/api/src/modules/knowledge/`
- `apps/api/src/modules/runtime-knowledge/`
- `apps/api/src/modules/repo-knowledge/`
- `apps/api/src/modules/agents/`
- `apps/api/src/modules/autonomy/`
- `apps/api/src/modules/ops/`
- `docs/bcp/`

### Definition of Done

- existe taxonomía estable en el canon;
- existe aterrizaje a módulos del monorepo;
- existe política de retención;
- existe backlog ejecutable para convertir la capa en implementación.

### Avance ejecutado al 2026-04-13

- `packages/shared/src/operator-context.ts` define `OperatorContext` como contrato transversal.
- `packages/auth/src/operator-context.ts` ya construye contexto operativo desde identidad o sesión.
- `packages/knowledge/src/workspace/` ya expone `WorkspaceMemoryRecord`, `WorkspaceMemoryQuery` y `WorkspaceMemoryStore`.
- `packages/autonomy/src/index.ts` ya registra `operator_context_resolved` dentro del runtime.
- `apps/api/src/modules/autonomy/` ya recibe `workspaceId`, `repoId` y `taskId` y emite `run_summary` a memoria contextual.

### Avance ejecutado al 2026-04-14

- `workspace_memory` ya quedo expuesto por API y conectado al runtime como memoria contextual consultable.
- `modules/knowledge/` ya expone lectura contextual persistida por `workspaceId`.
- `AgentRun.inputJson` ya incorpora `operatorContext`.
- `packages/agents/src/runtime.ts` ya audita el contexto operativo en ejecución gobernada.
- `apps/api/src/modules/agents/agents.service.ts` ya escribe `run_summary` contextual al completar o fallar runs.
- `apps/api/src/modules/ops/ops.service.ts` ya muestra `operatorContext` y memoria contextual en runtime trace.
- `apps/web/app/(app)/admin/ops/page.tsx` y `apps/web/app/cortex/semse-cortex-console.tsx` ya visualizan contexto operativo y memoria contextual.
- `opsAgentRuntimeQuerySchema` y Admin Ops ya permiten filtrar por `workspaceId`, `operatorId` y `memoryTag`.
- `tests/unit/operacion-asistida.test.ts` cubre filtros y audit trail de `operatorContext`.
- `npm run smoke:operacion-asistida` valida el flujo real contra API viva.
- `docs/bcp/` ya contiene runbook y checklist de recuperacion para `backup_recovery`.
- `npm run verify:operacion-asistida:bcp` valida que la capa BCP minima de operacion asistida esta presente y trazable.
- `npm run drill:operacion-asistida:bcp` ejecuta simulacion local de recuperacion sin API/DB viva.
- `SEMSE_BCP_DRILL_MODE=api` deja preparado el interruptor para ejecutar el mismo drill contra API viva.
- `npm run verify:operacion-asistida:local` ejecuta verificacion documental y drill local en una sola orden.
- Cada drill local genera evidencia `latest` y evidencia historica por timestamp en `docs/bcp/evidence/`.
- `docs/bcp/evidence/manifest.json` mantiene el ultimo resultado y un historial resumido de las ultimas 50 corridas.
- `npm run drill:operacion-asistida:api-local` ya levanta API compilada, corre migraciones, espera health Prisma y ejecuta el drill contra endpoints reales.
- El drill API emite token por `/v1/auth/token`, usa sesion real y valida `AgentRun`, Ops trace y `workspace_memory`.
- `npm run verify:operacion-asistida:api-local` queda como gate compuesto para BCP + API local.
- `.github/workflows/operacion-asistida-api.yml` ya integra el gate a CI con `postgres` y `redis`.
- el job publica `docs/bcp/evidence/` como artefacto para trazabilidad del manifiesto BCP.
- `WorkspaceMemoryEntry` ya existe como modelo Prisma dedicado y `WorkspaceMemoryRepository` ya hace lectura dual temporal con legado en `KnowledgeFact`.
- `npm run review:operacion-asistida:risk` ya genera revision de riesgo operativa desde el manifiesto.
- `npm run review:operacion-asistida:governance` ya promueve esa revision a governance y backlog historico.
- `npm run drill:operacion-asistida:restore` ya valida reconstruccion aislada desde la evidencia mas reciente.
- `npm run verify:operacion-asistida:module` ya cierra el modulo en una sola orden con gate API local + riesgo + restore aislado.
- `npm run audit:operacion-asistida:workspace-memory-legacy` ya mide la deuda legacy de `KnowledgeFact` y puede absorberla bajo confirmacion explicita por variable de entorno.
- la ultima auditoria local de `workspace_memory` ya dejo `pendingBackfillRecords: 0`, habilitando plan de retiro gradual del reader legacy.
- `npm run verify:operacion-asistida:dedicated-store` ya valida el modulo sobre `WorkspaceMemoryEntry` sin fallback a `KnowledgeFact`.
- `npm run verify:operacion-asistida:dedicated-store` ya fue ejecutado con resultado satisfactorio sobre API local.
- la lectura legacy ya fue retirada del reader de `workspace_memory`.

### Siguiente corte ejecutable de la Épica 0

1. Permitir escritura/lectura contextual desde más módulos además de `autonomy` y `agents`.
2. endurecer el drill de restore para escenarios multi-entorno con infraestructura aislada real.
3. extender escritura/lectura contextual a modulos de negocio adicionales.
4. consolidar la observacion post-retiro para confirmar que no quedan dependencias ocultas a `KnowledgeFact`.

## Épica A — Event to Agent Runtime

Objetivo:
Conectar los eventos del dominio con la creación automática de `AgentRun`.

### Tickets

1. Crear `DomainEventBus` interno en `apps/api`.
2. Crear `AgentTriggerRouter` que lea `triggers` desde `domain-events.schema.ts`.
3. Al emitir un evento, crear `AgentRun` por trigger aplicable.
4. Persistir `inputJson` con contexto mínimo suficiente y `correlationId`.
5. Emitir `AuditLog` de creación reactiva.

### Rutas probables

- `apps/api/src/modules/agents/`
- `apps/api/src/common/`
- `packages/schemas/src/domain-events.schema.ts`

### Definition of Done

- `job.created` dispara runs de `pricing` y `risk`
- `job.assigned` dispara `job-planner` y `risk`
- `milestone.submitted` dispara `evidence-coach`
- `job.disputed` dispara `dispute` y `risk`

---

## Épica B — Agent Executor Real

Objetivo:
Reemplazar la simulación del worker por ejecutores reales por tipo de agente.

### Tickets

1. Crear `agent executor registry` en `apps/worker`.
2. Implementar interfaz común:
   - `loadContext`
   - `execute`
   - `validateOutput`
   - `summarize`
3. Crear ejecutor `job-planner`.
4. Crear ejecutor `pricing`.
5. Crear ejecutor `evidence-coach`.
6. Crear ejecutor `risk`.
7. Guardar `outputJson`, `confidence`, `outputSummary`, `requiresHumanReview`.

### Rutas probables

- `apps/worker/src/`
- `packages/agents/src/`
- `apps/api/src/modules/agents/`

### Definition of Done

- el worker resuelve un `AgentRun` según `agentType`
- cada agente devuelve JSON estable
- los errores quedan normalizados en `run.error`

---

## Épica C — Output Contracts by Agent

Objetivo:
Tipar outputs para que la IA pueda integrarse con negocio sin improvisación.

### Tickets

1. Crear schemas Zod para output de `job-planner`.
2. Crear schemas Zod para output de `pricing`.
3. Crear schemas Zod para output de `evidence-coach`.
4. Crear schemas Zod para output de `risk`.
5. Versionar contratos de entrada/salida de agentes.

### Contratos mínimos sugeridos

`job-planner`
- `milestones[]`
- `estimatedDays`
- `scopeGaps[]`
- `risks[]`
- `confidence`

`pricing`
- `estimatedMin`
- `estimatedMax`
- `breakdown[]`
- `assumptions[]`
- `confidence`

`evidence-coach`
- `qualityScore`
- `missingItems[]`
- `feedback`
- `approveRecommendation`
- `confidence`

`risk`
- `riskScore`
- `riskLevel`
- `flags[]`
- `recommendation`
- `requiresHumanReview`

### Rutas probables

- `packages/schemas/src/`
- `packages/agents/src/`

### Definition of Done

- ningún agente completa un run con output no validado

---

## Épica D — Context Loader por entidad

Objetivo:
Dar a cada agente el contexto correcto del dominio, no prompts huérfanos.

### Tickets

1. Crear `JobContextLoader`
2. Crear `MilestoneContextLoader`
3. Crear `DisputeContextLoader`
4. Crear `PaymentContextLoader`
5. Crear `ProfessionalContextLoader`
6. Normalizar `inputSummary`

### Contexto mínimo por tipo

Job:
- datos del job;
- historial relevante;
- presupuesto;
- categoría;
- urgencia;
- actor originador.

Milestone:
- milestone;
- contrato;
- checklist;
- evidencia cargada;
- revisiones previas.

Dispute:
- timeline;
- evidencia;
- hitos;
- pagos;
- actor que abrió;
- resolución pendiente.

### Rutas probables

- `apps/api/src/modules/jobs/`
- `apps/api/src/modules/milestones/`
- `apps/api/src/modules/disputes/`
- `apps/api/src/modules/payments/`
- `apps/worker/src/`

---

## Épica E — Operational Memory

Objetivo:
Crear memoria útil por entidad del sistema.

### Tickets

1. Crear modelo `EntityMemory` o equivalente resumido.
2. Actualizar memoria al cerrar eventos relevantes.
3. Exponer lectura para agentes y ops.
4. Generar resumen incremental por:
   - `Job`
   - `Contract`
   - `Milestone`
   - `Dispute`
   - `User`
5. Separar memoria conversacional de memoria operativa.

### Campos sugeridos

- `entityType`
- `entityId`
- `tenantId`
- `summary`
- `openRisks[]`
- `pendingDecisions[]`
- `lastEventAt`
- `version`

### Rutas probables

- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/agents/`
- `apps/api/src/common/`

### Definition of Done

- un agente puede leer un resumen vivo de la entidad sin reconstruir todo desde cero

---

## Épica F — Human Review Gates

Objetivo:
Evitar automatización irresponsable.

### Tickets

1. Definir reglas para `requiresHumanReview`.
2. Agregar `reviewReason` en output sensible.
3. Crear cola o bandeja de revisión para Ops.
4. Marcar automáticamente como revisión humana:
   - disputas
   - retenciones de pago
   - riesgo alto
   - flags de fraude
5. Exponer filtros en panel Ops.

### Rutas probables

- `apps/api/src/modules/agents/`
- `apps/api/src/modules/ops/`
- `apps/web/app/`

### Definition of Done

- ningún output sensible se aplica silenciosamente

---

## Épica G — ECV Guardrail

Objetivo:
Introducir una validación previa a outputs de alto impacto.

### Tickets

1. Definir contrato del agente `ecv`.
2. Ejecutar `ecv` antes de completar acciones sensibles.
3. Validar:
   - tono concluyente ilegal;
   - recomendaciones financieras demasiado fuertes;
   - lenguaje discriminatorio;
   - acciones no permitidas por fase;
   - ausencia de evidencia mínima.
4. Guardar `violations[]` y `revisedResponse`.

### Rutas probables

- `packages/agents/src/`
- `packages/schemas/src/`
- `apps/worker/src/`

### Definition of Done

- `risk` y `dispute` pasan por `ecv` cuando generan recomendación sensible

---

## Épica H — Domain Integration

Objetivo:
Hacer que el output de los agentes afecte el sistema de forma controlada.

### Tickets

1. `job-planner` propone milestones prellenados para revisión.
2. `pricing` rellena pricing suggestion en publicación de job.
3. `evidence-coach` genera checklist correctiva antes de revisión final.
4. `risk` genera flags visibles en pagos, contratos y disputas.
5. `trust-match` alimenta ranking de profesionales.

### Definition of Done

- el output de cada agente aparece en una superficie clara del producto

---

## Épica I — Ops Surfaces

Objetivo:
Dar visibilidad a la operación agentic.

### Tickets

1. Panel de `AgentRuns` por tipo, estado y tenant.
2. Vista de runs con baja confianza.
3. Vista de runs que requieren revisión humana.
4. Vista de latencia, error rate y retry rate.
5. Vista de impacto por agente.

### KPIs iniciales

- runs por agente
- success rate
- average execution time
- human review rate
- completion with accepted recommendation

### Rutas probables

- `apps/api/src/modules/ops/`
- `apps/web/app/(app)/agents/`
- `apps/web/app/semse-control-surface.tsx`

---

## Épica J — Outcome Metrics

Objetivo:
Medir valor real, no volumen de texto generado.

### Métricas por negocio

- tasa de jobs publicados con scope suficiente
- tiempo de aprobación de milestone
- porcentaje de evidencia rechazada
- disputas por categoría
- pagos retenidos por riesgo alto
- tiempo de resolución ops
- calidad del match

### Métricas por agente

- precisión percibida
- aceptación de recomendación
- false positives en riesgo
- false positives en evidencia
- porcentaje de escalaciones correctas

---

## 5. Sprint plan recomendado

## Sprint AI-1

Objetivo:
Conectar eventos del dominio a `AgentRun`.

Entregables:

- `DomainEventBus`
- `AgentTriggerRouter`
- creación automática de runs para 4 eventos

## Sprint AI-2

Objetivo:
Ejecutores reales para `job-planner` y `pricing`.

Entregables:

- registry de ejecutores
- schemas de output
- integración a creación/publicación de job

## Sprint AI-3

Objetivo:
Ejecutor real de `evidence-coach`.

Entregables:

- context loader de milestone
- score de calidad de evidencia
- checklist correctiva en UI o API

## Sprint AI-4

Objetivo:
Ejecutor real de `risk`.

Entregables:

- risk output tipado
- integración con pagos, contratos y disputas
- gates de revisión humana

## Sprint AI-5

Objetivo:
Memoria operativa + panel Ops.

Entregables:

- resumen por entidad
- listados de runs sensibles
- panel de confianza y errores

## Sprint AI-6

Objetivo:
`trust-match` + `ecv`.

Entregables:

- ranking explicable de profesionales
- guardrail constitucional para outputs sensibles

---

## 6. Riesgos de implementación

1. Lanzar LLM real sin contratos de output.
2. Crear agentes sin integrar eventos del dominio.
3. Mezclar memoria de chat con memoria operativa.
4. Automatizar pagos o disputas antes de tener review gates.
5. Medir actividad del agente y no impacto de negocio.
6. Hacer prompts complejos sin context loaders sólidos.

---

## 7. Decisión ejecutiva

SEMSE ya tiene la base para una capa agentic seria.
La decisión correcta ahora no es expandir el catálogo.
La decisión correcta es cerrar este circuito:

**evento -> run -> ejecución tipada -> validación -> surface de producto -> métrica**

Cuando ese circuito exista en `job-planner`, `pricing`, `evidence-coach` y `risk`, recién ahí valdrá la pena escalar `trust-match`, `orchestrator` y `ecv`.
