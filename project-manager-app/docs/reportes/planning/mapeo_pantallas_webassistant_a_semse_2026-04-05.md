# Mapeo de Pantallas WebAssistant -> SEMSE

Fecha: 2026-04-05

Documentos relacionados:

- [dtos_exactos_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/dtos_exactos_integracion_semse_webassistant_2026-04-05.md)
- [historias_jira_linear_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/historias_jira_linear_integracion_semse_webassistant_2026-04-05.md)

## Objetivo

Mapear las pantallas visibles de `WebAssistant Portal` a:

- módulo funcional
- DTOs necesarios
- endpoints esperados de `SEMSE`
- decisión de integración
- notas de migración

## Pantallas detectadas en WebAssistant

Rutas observables en el bundle público:

- `/`
- `/projects`
- `/projects/:id`
- `/editor/:projectId/:fileId?`
- `/documents`
- `/tasks`
- `/ai`
- `/settings`
- `/activity`
- `/notifications`
- `/builder`
- `/rag-tools`
- `/semse`
- `/prometeo`
- `/profile`

---

## Tabla principal

| Pantalla actual | Módulo destino | DTOs principales | Endpoints SEMSE esperados | Decisión | Notas |
|---|---|---|---|---|---|
| `/` Home | Shell / entrada | `SessionView`, `UserIdentityView` | `/me`, `/permissions` | conservar y rebrandear como entry del workspace | dejar login y redirección por rol/proyecto |
| `/projects` | Projects | `ProjectSummary`, `ApiResponse<ProjectSummary[]>` | `GET /v1/projects` | reemplazar data actual por consumo real | esta pantalla pasa a ser el listado canónico |
| `/projects/:id` | Projects | `ProjectWorkspaceView`, `ProjectView`, `JobCardView`, `MilestoneView`, `TrustSnapshotView` | `GET /v1/projects/:id`, `GET /v1/projects/:id/jobs`, `GET /v1/projects/:id/milestones`, `GET /v1/projects/:id/activity` | convertir en workspace unificado | debe ser la pantalla central del producto |
| `/editor/:projectId/:fileId?` | Docs | `DocumentView`, `DocumentVersionView`, `LinkedEntityRef` | `GET /v1/documents/:id`, `GET /v1/documents/:id/versions`, `POST /v1/documents/:id/versions` | conservar como editor principal | renombrar mentalmente de “file” a “document” |
| `/documents` | Docs | `DocumentSummaryView[]` | `GET /v1/projects/:id/documents` o variante por contexto | conservar pero contextualizar por proyecto | evitar que sea un repo de docs separado del dominio |
| `/tasks` | Projects / Milestones | `MilestoneView[]`, `ActivityItemView[]` | `GET /v1/projects/:id/milestones`, `GET /v1/projects/:id/jobs` | redefinir | esta pantalla debe trabajar sobre milestones y tareas operativas reales |
| `/ai` | AI | `CopilotMessageView[]`, `AgentRunView[]`, `CopilotActionView[]`, `ProjectAgentContextView` | `GET /v1/projects/:id/copilot/history`, `POST /v1/agents/runs`, `GET /v1/agents/runs/:id`, `GET /v1/projects/:id/agent-context` | conservar como consola AI | debe quedar amarrada a `projectId` |
| `/settings` | Shell / Config | `SessionView`, preferencias UI | `/me`, `/preferences` si existe | conservar | no debe mezclar settings del dominio con prefs de UI |
| `/activity` | Activity / Ops | `ActivityItemView[]`, `AgentRunView[]` | `GET /v1/projects/:id/activity`, `GET /v1/ops/activity` si aplica | conservar y reconectar | activity debe salir de eventos de dominio y audit |
| `/notifications` | Activity / Alerts | `ActivityItemView[]` o DTO específico | `GET /v1/notifications` o derivado de eventos | conservar con scope claro | se puede derivar de eventos si no hay módulo dedicado |
| `/builder` | AI / Builder | `CopilotActionView[]`, plantillas o specs | `POST /v1/projects/:id/copilot/actions` | redefinir | sirve como generador de artefactos o flujos sobre dominio real |
| `/rag-tools` | RAG | `CorpusStatusView`, `SearchResultChunkView[]`, `CitedAnswerView` | `GET /v1/projects/:id/corpus-status`, `POST /v1/projects/:id/search`, `GET /v1/documents/:id/chunks` | conservar | no activar como módulo principal hasta P2 |
| `/semse` | SEMSE Console | `ProjectWorkspaceView`, `TrustSnapshotView`, `ControlSurfaceSnapshot` | varios según módulo | absorber o reconvertir | esta pantalla puede terminar siendo un hub o desaparecer |
| `/prometeo` | AI especializada | `AgentRunView`, `CopilotActionView` | `POST /v1/agents/runs`, endpoints de acciones | conservar como vista especializada o un modo de AI | no debe crear backend paralelo |
| `/profile` | Identity | `UserIdentityView` | `/me`, `/profile` | conservar | fuente de verdad de identidad sigue siendo auth central |

---

## Detalle pantalla por pantalla

## 1. `/projects`

### Estado actual esperado

- listado de proyectos del portal

### Integración correcta

- debe convertirse en la vista oficial de `ProjectSummary[]`
- no debe usar mock data ni almacenamiento separado

### DTOs

- `ProjectSummary`
- `ApiResponse<ProjectSummary[]>`

### Endpoints

- `GET /v1/projects`

### Componentes recomendados

- `ProjectsPage`
- `ProjectFiltersBar`
- `ProjectList`
- `ProjectCard`

### Riesgo

- mantener filtros o columnas que dependan de datos no expuestos por `SEMSE`

---

## 2. `/projects/:id`

### Estado actual esperado

- detalle o dashboard de proyecto

### Integración correcta

- debe ser el `Project Workspace`
- desde aquí se accede a `Docs`, `AI`, `Field Ops`, `Payments`, `Disputes`

### DTOs

- `ProjectWorkspaceView`
- `ProjectView`
- `JobCardView`
- `MilestoneView`
- `TrustSnapshotView`
- `ActivityItemView`

### Endpoints

- `GET /v1/projects/:id`
- `GET /v1/projects/:id/jobs`
- `GET /v1/projects/:id/milestones`
- `GET /v1/projects/:id/activity`

### Decisión

- esta es la pantalla más importante a rediseñar y consolidar

---

## 3. `/editor/:projectId/:fileId?`

### Estado actual esperado

- editor de código o archivos

### Integración correcta

- reinterpretarlo como editor de documentos / artefactos del proyecto
- si también edita código real, separar:
  - `source files`
  - `project docs`

### DTOs

- `DocumentView`
- `DocumentVersionView`
- `LinkedEntityRef`

### Endpoints

- `GET /v1/documents/:id`
- `GET /v1/documents/:id/versions`
- `POST /v1/documents/:id/versions`

### Riesgo

- seguir usando la semántica de “file” cuando el dominio real necesita “document”

---

## 4. `/documents`

### Integración correcta

- debe ser la biblioteca documental del proyecto activo o del tenant con filtros

### DTOs

- `DocumentSummaryView[]`

### Endpoints

- `GET /v1/projects/:id/documents`

### Decisión

- conservar la pantalla, pero dejar claro el scope:
  - por proyecto
  - por tipo
  - por estado

---

## 5. `/tasks`

### Integración correcta

- no inventar un task system paralelo
- mapear a:
  - milestones
  - revisiones pendientes
  - approvals
  - blockers de field ops

### DTOs

- `MilestoneView`
- `ActivityItemView`
- opcional `WorklogView`

### Endpoints

- `GET /v1/projects/:id/milestones`
- `GET /v1/projects/:id/activity`

### Decisión

- redefinir la pantalla como “Work Queue” o “Tasks & Milestones”

---

## 6. `/ai`

### Integración correcta

- consola AI general del proyecto
- debe estar grounded en `projectId`

### DTOs

- `CopilotMessageView`
- `AgentRunView`
- `CopilotActionView`
- `ProjectAgentContextView`
- `CitationRef`

### Endpoints

- `GET /v1/projects/:id/copilot/history`
- `POST /v1/agents/runs`
- `GET /v1/agents/runs/:id`
- `GET /v1/projects/:id/agent-context`
- `POST /v1/projects/:id/copilot/actions`

### Riesgo

- chat global sin contexto de proyecto o con contexto ambiguo

---

## 7. `/activity`

### Integración correcta

- timeline unificado del proyecto
- debe venir de eventos y auditoría, no de inventario manual en frontend

### DTOs

- `ActivityItemView`
- `AgentRunView`

### Endpoints

- `GET /v1/projects/:id/activity`

### Decisión

- conservar
- priorizar después de `Projects`, `Docs`, `AI`

---

## 8. `/notifications`

### Integración correcta

- puede ser una derivación filtrada de `Activity`
- o un inbox separado si existe backend específico

### DTOs

- `ActivityItemView`

### Decisión

- no sobreinvertir temprano
- primero consolidar eventos y timeline

---

## 9. `/builder`

### Integración correcta

- usarlo como constructor de artefactos operativos:
  - briefs
  - specs
  - scopes
  - planes de milestones
  - resúmenes ejecutables para agentes

### DTOs

- `CopilotActionView`
- `DocumentView`

### Endpoints

- `POST /v1/projects/:id/copilot/actions`
- `POST /v1/projects/:id/documents`

### Decisión

- conservar, pero aterrizarlo al dominio

---

## 10. `/rag-tools`

### Integración correcta

- vista avanzada de búsqueda y grounding
- no usar como home del producto

### DTOs

- `CorpusStatusView`
- `SearchResultChunkView`
- `CitedAnswerView`

### Endpoints

- `GET /v1/projects/:id/corpus-status`
- `POST /v1/projects/:id/search`
- `GET /v1/documents/:id/chunks`

### Decisión

- módulo P2

---

## 11. `/semse`

### Integración correcta

- esta ruta es redundante si todo el producto converge

Opciones:

- convertirla en “SEMSE Console” solo para ops/admin
- absorberla dentro del workspace
- eliminarla como entry separada

### DTOs

- dependerá del caso:
  - `ProjectWorkspaceView`
  - `ControlSurfaceSnapshot`
  - `TrustSnapshotView`

### Decisión recomendada

- no dejarla como producto paralelo

---

## 12. `/prometeo`

### Integración correcta

- puede quedar como modo experto del módulo AI
- o como perfil/agente especializado dentro de `AI`

### DTOs

- `AgentRunView`
- `CopilotActionView`
- `CitationRef`

### Decisión recomendada

- mantener la marca si aporta valor
- pero técnicamente debe usar los mismos runs y acciones del sistema unificado

---

## 13. `/settings` y `/profile`

### Integración correcta

- shell y perfil de usuario

### DTOs

- `SessionView`
- `UserIdentityView`

### Decisión

- mantener separados del dominio del proyecto

---

## Pantallas faltantes que SEMSE sí necesita

Aunque `WebAssistant` tiene bastante superficie, para la convergencia faltan vistas operativas explícitas:

### A. `Field Ops`

Ruta recomendada:

- `/projects/:projectId/field-ops`

DTOs:

- `FieldUnitView`
- `WorklogView`
- `ComplianceDocView`
- `VendorView`

### B. `Payments`

Ruta recomendada:

- `/projects/:projectId/payments`

DTOs:

- `EscrowSummaryView`
- `PaymentSummaryView`
- `MilestonePaymentStatusView`

### C. `Disputes`

Ruta recomendada:

- `/projects/:projectId/disputes`
- `/disputes/:disputeId`

DTOs:

- `DisputeSummaryView`
- `DisputeView`
- `DisputeTimelineEventView`
- `DisputeRelatedRecordsView`

---

## Mapa de reemplazo / conservación

### Conservar casi directo

- `/projects`
- `/projects/:id`
- `/documents`
- `/ai`
- `/activity`
- `/settings`
- `/profile`

### Conservar pero redefinir

- `/editor/:projectId/:fileId?`
- `/tasks`
- `/builder`
- `/prometeo`
- `/semse`

### Agregar

- `/projects/:projectId/field-ops`
- `/projects/:projectId/payments`
- `/projects/:projectId/disputes`

### Posponer

- `/rag-tools`

---

## Orden práctico de migración de pantallas

1. `/projects`
2. `/projects/:id`
3. `/documents`
4. `/ai`
5. `/editor/:projectId/:fileId?`
6. `/tasks`
7. nuevas pantallas:
   - `field-ops`
   - `payments`
   - `disputes`
8. `/activity`
9. `/rag-tools`

---

## Conclusión

`WebAssistant` ya tiene mucha de la superficie visual necesaria, pero hoy parece orientado a productividad genérica.

La integración con `SEMSE` debe hacer tres cosas:

1. convertir `projects` en workspace canónico
2. aterrizar `docs`, `ai` y `builder` al dominio real
3. agregar las pantallas operativas que faltan: `field-ops`, `payments`, `disputes`

Con este mapeo, la migración se vuelve incremental:

- no hace falta tirar `WebAssistant`
- hace falta reconectarlo
- y completar la superficie que el dominio de `SEMSE` sí exige
