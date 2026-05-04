# Historias Jira / Linear Integración SEMSE + WebAssistant

Fecha: 2026-04-05

Documento previo:

- [dtos_exactos_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/dtos_exactos_integracion_semse_webassistant_2026-04-05.md)

## Objetivo

Traducir el backlog técnico a un formato cercano a Jira/Linear:

- épicas
- historias
- subtareas
- criterios de aceptación
- prioridad

## Convención sugerida

- `EPIC-*` para épicas
- `STORY-*` para historias
- `TASK-*` para subtareas

---

## EPIC-1: Fundaciones de Integración

Objetivo:

- unificar identidad, contratos y rutas base

### STORY-1.1

- Título: Como frontend integrado, necesito propagar contexto de actor y tenant a SEMSE para consumir APIs con permisos correctos
- Prioridad: `P0`
- Tipo: `Auth`
- Criterios de aceptación:
  - todas las requests salientes incluyen `tenant`, `org`, `user`, `roles`, `requestId`
  - errores de permisos se exponen con shape estándar

Subtareas:

- `TASK-1.1.1` Definir `ActorContextView`
- `TASK-1.1.2` Agregar propagación de headers en client SDK
- `TASK-1.1.3` Validar rechazo de requests incompletas en API

### STORY-1.2

- Título: Como equipo de plataforma, necesito DTOs canónicos compartidos para evitar drift entre apps
- Prioridad: `P0`
- Tipo: `Schema`
- Criterios de aceptación:
  - existen `ProjectView`, `DocumentView`, `AgentRunView`
  - exports centralizados en `packages/schemas`

Subtareas:

- `TASK-1.2.1` Crear `common.api.ts`
- `TASK-1.2.2` Crear `project.view.ts`
- `TASK-1.2.3` Crear `document.view.ts`
- `TASK-1.2.4` Crear `agent.view.ts`

### STORY-1.3

- Título: Como usuario, necesito una navegación única por proyecto para no sentir dos productos distintos
- Prioridad: `P0`
- Tipo: `UI`
- Criterios de aceptación:
  - rutas unificadas por `projectId`
  - layout reusable para todos los módulos

Subtareas:

- `TASK-1.3.1` Definir rutas canónicas
- `TASK-1.3.2` Diseñar `ProjectWorkspaceLayout`
- `TASK-1.3.3` Alinear sidebar y header contextual

---

## EPIC-2: Projects

Objetivo:

- convertir proyectos de `SEMSE` en la base real del workspace

### STORY-2.1

- Título: Como usuario, quiero ver un listado real de proyectos desde SEMSE
- Prioridad: `P0`
- Tipo: `API/UI`
- Criterios de aceptación:
  - `ProjectsPage` consume `GET /v1/projects`
  - soporta `loading`, `empty`, `error`

Subtareas:

- `TASK-2.1.1` Implementar `ProjectSummary`
- `TASK-2.1.2` Exponer `GET /v1/projects`
- `TASK-2.1.3` Conectar listado en WebAssistant

### STORY-2.2

- Título: Como usuario, quiero abrir un workspace unificado de proyecto con estado, jobs y milestones
- Prioridad: `P0`
- Tipo: `API/UI`
- Criterios de aceptación:
  - la vista usa `GET /v1/projects/:id`
  - muestra jobs y milestones relacionados

Subtareas:

- `TASK-2.2.1` Implementar `ProjectView`
- `TASK-2.2.2` Exponer `GET /v1/projects/:id`
- `TASK-2.2.3` Exponer `GET /v1/projects/:id/jobs`
- `TASK-2.2.4` Exponer `GET /v1/projects/:id/milestones`
- `TASK-2.2.5` Construir `ProjectWorkspaceView`

### STORY-2.3

- Título: Como usuario, quiero ver warnings y estado de confianza del proyecto en el header
- Prioridad: `P1`
- Tipo: `UI`
- Criterios de aceptación:
  - `TrustBadge` visible
  - warnings del proyecto visibles en layout

---

## EPIC-3: Docs

Objetivo:

- convertir `Docs` en módulo oficial conectado al dominio

### STORY-3.1

- Título: Como usuario, quiero explorar documentos oficiales de un proyecto
- Prioridad: `P0`
- Tipo: `API/UI`
- Criterios de aceptación:
  - `DocumentExplorer` consume `GET /v1/projects/:id/documents`
  - cada documento muestra tipo, estado y última edición

Subtareas:

- `TASK-3.1.1` Definir `DocumentSummaryView`
- `TASK-3.1.2` Exponer listado de documentos
- `TASK-3.1.3` Implementar explorer

### STORY-3.2

- Título: Como usuario, quiero editar un documento sin confundir borrador con versión oficial
- Prioridad: `P0`
- Tipo: `UI`
- Criterios de aceptación:
  - existe diferenciación clara entre `draft` y `published`
  - editor muestra estado actual del documento

Subtareas:

- `TASK-3.2.1` Definir `DocumentView`
- `TASK-3.2.2` Implementar `DocumentEditor`
- `TASK-3.2.3` Agregar `DocumentPublishBar`

### STORY-3.3

- Título: Como usuario, quiero publicar versiones auditables de documentos
- Prioridad: `P0`
- Tipo: `API`
- Criterios de aceptación:
  - existe `DocumentVersionView`
  - se puede consultar historial de versiones

Subtareas:

- `TASK-3.3.1` Exponer `POST /v1/documents/:id/versions`
- `TASK-3.3.2` Exponer `GET /v1/documents/:id/versions`
- `TASK-3.3.3` Bloquear edición de versión publicada

### STORY-3.4

- Título: Como analista, quiero enlazar documentos con evidencia y disputas
- Prioridad: `P1`
- Tipo: `API/UI`

---

## EPIC-4: AI

Objetivo:

- conectar copiloto con contexto real y acciones auditables

### STORY-4.1

- Título: Como usuario, quiero conversar con un copiloto contextual del proyecto
- Prioridad: `P0`
- Tipo: `API/UI`
- Criterios de aceptación:
  - chat ligado a `projectId`
  - historial consultable
  - mensajes pueden mostrar citas

Subtareas:

- `TASK-4.1.1` Definir `CopilotMessageView`
- `TASK-4.1.2` Exponer historial por proyecto
- `TASK-4.1.3` Construir chat UI

### STORY-4.2

- Título: Como usuario, quiero ver runs de agentes con estado y resultado resumido
- Prioridad: `P0`
- Tipo: `API/UI`

Subtareas:

- `TASK-4.2.1` Definir `AgentRunView`
- `TASK-4.2.2` Exponer `GET /v1/agents/runs/:id`
- `TASK-4.2.3` Exponer history de runs por proyecto
- `TASK-4.2.4` Construir `AgentRunTimeline`

### STORY-4.3

- Título: Como usuario, quiero aprobar acciones AI antes de que afecten el dominio
- Prioridad: `P0`
- Tipo: `UI/API`
- Criterios de aceptación:
  - toda acción sensible requiere confirmación
  - se visualiza payload estructurado

Subtareas:

- `TASK-4.3.1` Definir `CopilotActionView`
- `TASK-4.3.2` Exponer endpoint de acción
- `TASK-4.3.3` Implementar `ActionApprovalModal`

---

## EPIC-5: Field Ops

Objetivo:

- integrar operación de campo dentro del workspace principal

### STORY-5.1

- Título: Como operador, quiero ver unidades de campo por proyecto
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-5.1.1` Definir `FieldUnitView`
- `TASK-5.1.2` Exponer listado de unidades
- `TASK-5.1.3` Construir `FieldUnitBoard`

### STORY-5.2

- Título: Como operador, quiero registrar worklogs estructurados y visibles en el proyecto
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-5.2.1` Definir `WorklogView`
- `TASK-5.2.2` Exponer create/list de worklogs
- `TASK-5.2.3` Implementar `WorklogComposer`
- `TASK-5.2.4` Implementar `WorklogFeed`

### STORY-5.3

- Título: Como supervisor, quiero ver compliance y vendors por proyecto
- Prioridad: `P1`
- Tipo: `API/UI`

---

## EPIC-6: Payments

Objetivo:

- mostrar estado financiero con reglas correctas y explicación clara

### STORY-6.1

- Título: Como usuario, quiero ver el resumen de escrow y la línea temporal de pagos del proyecto
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-6.1.1` Definir `EscrowSummaryView`
- `TASK-6.1.2` Definir `PaymentSummaryView`
- `TASK-6.1.3` Exponer endpoints de summary y timeline
- `TASK-6.1.4` Construir panel de pagos

### STORY-6.2

- Título: Como usuario, quiero saber si una acción financiera está permitida antes de ejecutarla
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-6.2.1` Definir `MilestonePaymentStatusView`
- `TASK-6.2.2` Agregar `allowedActions` y razones de bloqueo
- `TASK-6.2.3` Mostrar explainability en UI

### STORY-6.3

- Título: Como auditor, quiero ver trazabilidad de acciones financieras
- Prioridad: `P2`
- Tipo: `Observability`

---

## EPIC-7: Disputes

Objetivo:

- convertir disputas en expediente integral y navegable

### STORY-7.1

- Título: Como ops, quiero ver un inbox de disputas con estado y owner
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-7.1.1` Definir `DisputeSummaryView`
- `TASK-7.1.2` Exponer inbox
- `TASK-7.1.3` Construir `DisputeInbox`

### STORY-7.2

- Título: Como revisor, quiero abrir un expediente de disputa con timeline y evidencia
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-7.2.1` Definir `DisputeView`
- `TASK-7.2.2` Definir `DisputeTimelineEventView`
- `TASK-7.2.3` Exponer timeline
- `TASK-7.2.4` Construir detail page

### STORY-7.3

- Título: Como revisor, quiero navegar desde la disputa a pagos, docs, evidence y worklogs relacionados
- Prioridad: `P1`
- Tipo: `API/UI`

Subtareas:

- `TASK-7.3.1` Definir `DisputeRelatedRecordsView`
- `TASK-7.3.2` Exponer `related-records`
- `TASK-7.3.3` Construir paneles relacionados

---

## EPIC-8: RAG

Objetivo:

- agregar búsqueda semántica grounded sobre corpus autorizado

### STORY-8.1

- Título: Como usuario, quiero buscar semánticamente dentro del contexto del proyecto
- Prioridad: `P2`
- Tipo: `API/UI`

Subtareas:

- `TASK-8.1.1` Definir `SearchQueryInput`
- `TASK-8.1.2` Definir `SearchResultChunkView`
- `TASK-8.1.3` Exponer search endpoint
- `TASK-8.1.4` Construir `SemanticSearchInput`

### STORY-8.2

- Título: Como usuario, quiero respuestas de IA con citas verificables
- Prioridad: `P2`
- Tipo: `API/UI`

Subtareas:

- `TASK-8.2.1` Definir `CitedAnswerView`
- `TASK-8.2.2` Implementar render de citas
- `TASK-8.2.3` Integrar con chat AI

### STORY-8.3

- Título: Como operador, quiero ver el estado del corpus e indexación del proyecto
- Prioridad: `P2`
- Tipo: `API/UI`

---

## EPIC-9: Calidad y Operación

Objetivo:

- asegurar consistencia técnica, testeo y trazabilidad

### STORY-9.1

- Título: Como equipo, queremos un SDK tipado único para consumir SEMSE desde WebAssistant
- Prioridad: `P0`
- Tipo: `API`

### STORY-9.2

- Título: Como equipo, queremos estados de carga, vacío y error estandarizados
- Prioridad: `P1`
- Tipo: `UI`

### STORY-9.3

- Título: Como equipo, queremos invalidación de cache consistente por proyecto y submódulo
- Prioridad: `P1`
- Tipo: `UI`

### STORY-9.4

- Título: Como QA, queremos escenarios e2e del workspace unificado
- Prioridad: `P1`
- Tipo: `QA`

### STORY-9.5

- Título: Como ops, queremos activity timeline y auditabilidad transversal
- Prioridad: `P2`
- Tipo: `Observability`

---

## Secuencia sugerida para gestión real

1. Ejecutar `EPIC-1`
2. Ejecutar `EPIC-2`
3. Ejecutar `EPIC-3`
4. Ejecutar `EPIC-4`
5. Ejecutar `EPIC-5`
6. Ejecutar `EPIC-6`
7. Ejecutar `EPIC-7`
8. Ejecutar `EPIC-8`
9. Sostener `EPIC-9` transversalmente

## Resultado esperado

Si estas historias se ejecutan en orden:

- `SEMSE` conserva todo el dominio crítico
- `WebAssistant` deja de ser una consola paralela y pasa a ser un workspace real
- desaparecen duplicaciones de proyecto, documento y estado operativo
