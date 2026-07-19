# Decisiones de entidades canónicas — duplicaciones SEMSE

**Fecha:** 2026-07-17  
**Corte base:** `main` post-merge PR #330  
**Objetivo:** decidir, por cada duplicación detectada en el reporte de aterrizaje arquitectónico, cuál es el modelo canónico y cuáles son legacy/verticales a consolidar o deprecar.

---

## Resumen ejecutivo

| Dominio duplicado | Entidad canónica | Legacy/vertical que se consolida | Próximo paso |
|---|---|---|---|
| Comunicaciones | `CommunicationThread` / `Communication` | `MessageThread` / `Message` eliminadas; `ConversationThread`/`ConversationMessage` renombradas | Fase 1 y 2 completadas; schema, migración y repository actualizados |
| Tareas | `JobTask` (canónico en Fase 1) | `BuildOpsTask`, `AgroFarmTask` | Fase 1 lista: `JobTask` extendido con campos polimórficos para BuildOps y Agro; Fase 2/3 migrarán BuildOpsTask y AgroFarmTask |
| Documentos/evidencias | `Evidence` | `AgroEvidenceItem` | Extender `Evidence` con `entityType`/`entityId` para absorver evidencia agro; `PrometeoDocument` se mantiene como `KnowledgeSource` RAG; `MilestoneEvidenceItem` es checklist, no evidencia pura |
| Tracking de tiempo | `TimeEntry` / `LaborSheet` | `TrackerSession` eliminada; `WorklogEntry` pendiente (diario de campo) | Fase 1 completada: `TrackerSession` migrado a `TimeEntry`; `TimeEntry` extiende `contextEntityType`/`contextEntityId`; adaptador legacy mantiene `/v1/time-tracker` |
| Ejecuciones de agentes | `AgentRun` | `AlgorithmRun`, `BrowserMission`, `AutonomousPrRun`, `ProductIngestBatch` | Evaluar si `AgentRun` puede absorber `AlgorithmRun` y `BrowserMission` vía `kind`/`contextJson`; `AutonomousPrRun` y `ProductIngestBatch` son casos especiales |

---

## 1. Comunicaciones

**Tablas:** `MessageThread`/`Message` (legacy eliminada), `ConversationThread`/`ConversationMessage` renombradas a `CommunicationThread`/`Communication`.

**Decisión:**
- Canónico: `CommunicationThread` / `Communication`.
- Legacy a eliminar: `MessageThread` / `Message`.
- Justificación: `CommunicationThread`/`Communication` soportan `tenantId`, `channel` (`WHATSAPP_CLOUD`, `SMS`, `EMAIL`, `WEB_CHAT`), `direction`, `status`, `externalThreadId`, `contactPhone`, `jobId`, `projectId`, `contractorLeadId`. Es la bandeja omnicanal que pide la arquitectura unificada. `MessageThread`/`Message` no tenían `tenantId` ni consumidores.
- Fase 1 (completada): eliminar `MessageThread`/`Message` del esquema y la base de datos.
- Fase 2 (completada): renombrar `ConversationThread` → `CommunicationThread` y `ConversationMessage` → `Communication` mediante `ALTER TABLE ... RENAME TO` y renombrado de constraints/índices, manteniendo DTOs y endpoints públicos sin cambios.

---

## 2. Tareas

**Tablas:** `JobTask`, `BuildOpsTask`, `AgroFarmTask`.

**Decisión:**
- Canónico: `JobTask` actúa como `Task` canónico en Fase 1.
- `BuildOpsTask` es una tarea de plan/checklist de proyecto; migrará a `JobTask` con `domain = "buildops"` en Fase 2.
- `AgroFarmTask` es una tarea operativa agro; migrará a `JobTask` con `domain = "agro"` en Fase 3 (requiere añadir `tenantId` a `AgroFarm` para cumplir la Constitución Art. VII).
- Justificación: las tres tablas comparten `title`, `status`, `priority`, `dueDate`, `assignedTo`, pero cada una añade semántica propia (`evidenceRequired`, `templateKey`, `targetType`, `taskType`). El modelo unificado `JobTask` ahora soporta `domain`/`vertical`, `entityType`/`entityId`, y columnas específicas de BuildOps (`projectId`, `completion`, `sourceTool`, `evidenceRequired`, `assigneeName`) y Agro (`farmId`, `targetType`/`targetId`, `taskType`, `startedAt`, `completedAt`, `blockedAt`, `canceledAt`, `blockReason`, `cancelReason`, `notes`).
- Estado (Fase 1):
  1. `JobTask` se extendió con campos polimórficos y de contexto para absorber `BuildOpsTask` y `AgroFarmTask`.
  2. `jobId` y `milestone` se hicieron opcionales para permitir tareas no vinculadas a un job.
  3. Se añadieron índices por `tenantId + domain + status`, `projectId`, `farmId`, `(entityType, entityId)` y `(targetType, targetId)`.
  4. `TasksService` acepta `jobId` y `milestone` nulos en `TaskRecord`.
- Próximo paso (Fase 2): migrar `BuildOpsService`, `BuildOpsLegacyPromotionService`, `BuildOpsPlanRerunService` e `IntakeOperationsBridgeService` a leer/escribir `JobTask` con `domain='buildops'`, y migrar datos de `BuildOpsTask`.
- Próximo paso (Fase 3): añadir `tenantId` a `AgroFarm`, migrar `AgroTaskService`/`AgroTaskRepository` a `JobTask` con `domain='agro'`, y migrar datos de `AgroFarmTask`.

---

## 3. Documentos / evidencias

**Tablas:** `Evidence`, `PrometeoDocument`, `AgroEvidenceItem`, `MilestoneEvidenceItem`.

**Decisión:**
- Canónico: `Evidence` para evidencia operativa/auditada (fotos, videos, documentos vinculados a jobs/milestones/projects).
- `AgroEvidenceItem` debe converger hacia `Evidence` extendido con `entityType`/`entityId` para soportar `Farm`, `FarmUnit`, `Animal`, etc.
- `PrometeoDocument` es un documento de conocimiento/RAG; en el futuro puede renombrarse a `KnowledgeSource` o `Document` unificado, pero hoy no es evidencia operativa.
- `MilestoneEvidenceItem` es un requisito de evidencia por hito (checklist), no el archivo en sí; se mantiene como `MilestoneEvidenceItem`.
- Justificación: `Evidence` ya centraliza `bucketKey`, `kind`, `validationStatus`, `aiQualityScore`, `metadataJson`, `capturedAt`, `uploadedById`, `promotedFromBuildOps`. Es la entidad documental operativa de SEMSE.
- Próximo paso: extender `Evidence` con `entityType`/`entityId` y migrar `AgroEvidenceItem`.

---

## 4. Tracking de tiempo

**Tablas:** `WorklogEntry`, `TrackerSession`, `TimeEntry`, `LaborSheet`.

**Decisión:**
- Canónico: `TimeEntry` / `LaborSheet` (Labor Engine).
- Legacy a deprecar: `WorklogEntry` / `TrackerSession` (field-ops legacy).
- Justificación: `TimeEntry` soporta modo `realtime`/`manual`, propósito `personal`/`payable`/`job_linked`, breaks, hourly rate, currency, y se integra a resúmenes semanales/mensuales. `TrackerSession` y `WorklogEntry` son anteriores y no tienen todos los campos.
- Estado (Fase 1):
  1. `TimeEntry` se extendió con `contextEntityType`/`contextEntityId` y se indexó por `(tenantId, contextEntityType, contextEntityId)`.
  2. `TrackerSession` se eliminó del schema Prisma, se migraron sus filas a `TimeEntry` y se dropeó la tabla/enum en la migración `20260718000000_consolidate_tracker_session`.
  3. `FieldOpsRepository` ahora lee/escribe `TimeEntry` con `purpose='job_linked'` y `contextEntityType='Job'`, manteniendo el contrato `TrackerSessionRecord`/`TrackerSessionView` para los endpoints legacy `/v1/time-tracker`.
- Próximo paso (Fase 2):
  1. Migrar UI field-ops (`/worker/field-ops`, `/admin/field-ops`) a endpoints de Labor Engine (`/v1/labor/*`) y eliminar el adaptador legacy.
  2. Eliminar `WorklogEntry` una vez que no tenga consumidores (abordar en consolidación de documentos/evidencias o diarios de campo).

---

## 5. Ejecuciones de agentes / runs

**Tablas:** `AgentRun`, `AutonomousPrRun`, `BrowserMission`, `AlgorithmRun`, `ProductIngestBatch`.

**Decisión:**
- Canónico: `AgentRun` para la mayoría de las ejecuciones de agentes (tiene `agentType`, `triggerType`, `status`, `inputJson`, `outputJson`, `attempts`, `correlationId`, `startedAt`, `endedAt`, `error`).
- `AlgorithmRun` puede converger a `AgentRun` añadiendo `kind = "algorithm"` y guardando `toolName`/`trade`/`algorithmVersion` en `inputJson` o `contextJson`.
- `BrowserMission` puede converger a `AgentRun` con `kind = "browser"` y `steps` en `outputJson`.
- `AutonomousPrRun` y `ProductIngestBatch` son dominios específicos (autonomía de PRs e ingesta de product intelligence); no se tocan en esta fase.
- Justificación: la arquitectura unificada pide `automation_definitions` → `automation_runs` → `automation_steps`. `AgentRun` es el run más cercano; los demás son especializaciones.
- Próximo paso: decidir en un SDD si se crea una tabla `Run`/`Execution` polimórfica o si `AgentRun` absorbe los casos comunes.

---

## 6. Congelamiento de nuevas tablas

De aquí en adelante, **no se crean nuevas tablas** llamadas `tasks`, `messages`, `documents`, `time_entries`, `agent_runs` o similares sin aprobar un spec que las aterrice en el modelo canónico correspondiente. Las nuevas features deben extender las entidades canónicas o justificar explícitamente una vertical separada.

---

## Fuentes

- `docs/reportes/2026-07-17_aterrizaje_arquitectura_unificada.md`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/communications/`
- `apps/api/src/modules/labor-engine/`
- `apps/api/src/modules/field-ops/`
