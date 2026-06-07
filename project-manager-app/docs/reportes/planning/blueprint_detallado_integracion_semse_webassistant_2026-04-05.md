# Blueprint Detallado de Integración SEMSE + WebAssistant

Fecha: 2026-04-05

Documento base relacionado:

- [informe_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/informe_integracion_semse_webassistant_2026-04-05.md)

## Propósito

Bajar la integración a detalle técnico y operativo:

- contratos
- flujos
- estados
- permisos
- errores
- eventos
- ownership de datos
- dependencias entre módulos
- decisiones de UX y backend

Este documento asume la estrategia ya acordada:

1. `SEMSE` mantiene dominio y datos operativos.
2. `WebAssistant` consume APIs de `SEMSE`.
3. Se unifica identidad, navegación y modelo de proyecto.

---

## 1. Principios de diseño

### 1.1 Regla principal

`WebAssistant` no es un segundo backend de negocio.

Eso significa:

- no calcula estados finales de pagos
- no resuelve disputas
- no decide permisos
- no inventa el estado de un proyecto
- no mantiene documentos oficiales separados del dominio

### 1.2 Qué sí puede hacer WebAssistant

- componer vistas
- acelerar productividad
- editar borradores
- enriquecer experiencia documental
- ejecutar búsquedas semánticas
- invocar acciones IA
- mostrar explicaciones, resúmenes y copilotos

### 1.3 Regla de acoplamiento

Cada pantalla del usuario debe responder esta pregunta:

> ¿Esta vista modifica verdad operativa o solo experiencia?

Si modifica verdad operativa:

- la mutación va a `SEMSE`

Si solo modifica experiencia:

- puede vivir en `WebAssistant`

---

## 2. Modelo canónico y mapeo de entidades

## 2.1 Entidad raíz canónica

`Project` es la raíz del workspace unificado.

### Shape objetivo recomendado

```ts
type ProjectView = {
  id: string;
  tenantId: string;
  orgId: string;
  name: string;
  slug: string;
  status: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
  clientOrgId: string;
  ownerUserId: string;
  assignedProOrgId?: string | null;
  budget?: {
    amount: number;
    currency: string;
    type: "FIXED" | "TIME_AND_MATERIALS";
  } | null;
  jobId?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Compatibilidad con schemas actuales

Hoy ya existe un shape mínimo en `packages/schemas/src/project.schema.ts`:

- `id`
- `tenantId`
- `jobId`
- `assignedProOrgId`
- `status`

Brecha actual:

- falta enriquecer con `orgId`, `name`, `slug`, `clientOrgId`, `ownerUserId`, `budget`, timestamps completos y metadata de navegación

Decisión:

- ampliar schema de `ProjectSummary` hacia `ProjectView`
- mantener un `ProjectSummary` corto para listados rápidos

## 2.2 Subagregados obligatorios del proyecto

Cada proyecto puede tener:

- `Jobs`
- `Milestones`
- `Documents`
- `Evidence`
- `KnowledgeFacts`
- `FieldUnits`
- `Worklogs`
- `Payments`
- `Disputes`
- `TrustSnapshots`
- `AgentRuns`

### Ownership

| Entidad | Ownership |
|---|---|
| Project | `SEMSE` |
| Job | `SEMSE` |
| Milestone | `SEMSE` |
| Document metadata | `SEMSE` |
| Document draft transitorio | `WebAssistant` |
| Evidence | `SEMSE` |
| KnowledgeFact | `SEMSE` |
| FieldUnit | `SEMSE` |
| Worklog | `SEMSE` |
| Payment / Escrow | `SEMSE` |
| Dispute | `SEMSE` |
| TrustSnapshot | `SEMSE` |
| AgentRun | `SEMSE` |
| UI preferences | `WebAssistant` |
| Search UI state | `WebAssistant` |

---

## 3. Identidad, auth y contexto de request

## 3.1 Contexto mínimo obligatorio

Toda request saliente desde `WebAssistant` a `SEMSE` debe incluir:

- `x-tenant-id`
- `x-org-id`
- `x-user-id`
- `x-roles`
- `x-request-id`
- `x-session-id` opcional pero recomendable

### Por qué

- `tenantId` segmenta datos
- `orgId` define contexto organizacional operativo
- `userId` permite auditoría
- `roles` soporta RBAC en API
- `requestId` conecta logs, errores y auditoría

## 3.2 Fuente de permisos

`SEMSE` decide:

- acceso a proyecto
- acceso a documento
- acceso a disputa
- posibilidad de aprobar o liberar pagos
- acceso a corpus RAG

`WebAssistant` solo adapta:

- menús visibles
- botones habilitados
- texto de ayuda
- explainability de “por qué no puedes hacer esto”

## 3.3 Recomendación de auth

### Opción objetivo

- IdP único
- sesión única
- gateway o BFF que hidrate headers internos

### Opción pragmática de transición

- `WebAssistant` hace login
- obtiene claims
- proxya requests a `SEMSE` reinyectando headers

Riesgo si no se hace:

- doble sesión
- drift de roles
- errores de autorización incoherentes

---

## 4. Navegación unificada

## 4.1 Principio de UX

El usuario no debe sentir que cambia de producto.

Debe sentir:

- un solo workspace
- múltiples módulos del mismo proyecto

## 4.2 Rutas recomendadas

```text
/projects
/projects/:projectId
/projects/:projectId/docs
/projects/:projectId/ai
/projects/:projectId/rag
/projects/:projectId/field-ops
/projects/:projectId/payments
/projects/:projectId/disputes
/projects/:projectId/activity
/settings
```

## 4.3 Layout recomendado por proyecto

### Sidebar principal

- Overview
- Docs
- AI
- RAG
- Field Ops
- Payments
- Disputes
- Activity

### Header contextual

- nombre del proyecto
- estado
- trust level
- acciones rápidas
- breadcrumb de módulo

### Panel derecho opcional

- activity stream
- contextual AI suggestions
- related records
- warnings y blockers

---

## 5. Contratos transversales

## 5.1 Envelope de respuesta recomendado

```ts
type ApiSuccess<T> = {
  data: T;
  meta?: {
    requestId: string;
    version?: string;
    warnings?: string[];
  };
};

type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};
```

### Motivo

Permite que `WebAssistant`:

- renderice mensajes claros
- muestre `requestId`
- diferencie errores de permisos, validación, conflicto o disponibilidad

## 5.2 Códigos de error recomendados

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `PRECONDITION_FAILED`
- `RATE_LIMITED`
- `UPSTREAM_UNAVAILABLE`
- `DOMAIN_RULE_VIOLATION`

### Ejemplos

- intentar liberar pago sin evidencia -> `DOMAIN_RULE_VIOLATION`
- editar proyecto cancelado -> `PRECONDITION_FAILED`
- resolver disputa sin rol adecuado -> `FORBIDDEN`

## 5.3 Idempotencia

Mutaciones sensibles deben aceptar:

- `x-idempotency-key`

Aplicar al menos en:

- `POST /v1/agents/runs`
- `POST /v1/payments/approve`
- `POST /v1/payments/release`
- `POST /v1/payments/refund`
- `POST /v1/disputes`
- `POST /v1/documents/:id/versions`

---

## 6. Módulo Projects

## 6.1 Objetivo

Ser la columna vertebral del workspace.

## 6.2 APIs mínimas

### Read

- `GET /v1/projects`
- `GET /v1/projects/:id`
- `GET /v1/projects/:id/jobs`
- `GET /v1/projects/:id/milestones`
- `GET /v1/projects/:id/summary`
- `GET /v1/projects/:id/activity`

### Write

- `POST /v1/projects`
- `PATCH /v1/projects/:id`
- `PATCH /v1/projects/:id/status`

## 6.3 Componentes UI

- `ProjectListPage`
- `ProjectFiltersBar`
- `ProjectWorkspaceLayout`
- `ProjectOverviewCard`
- `ProjectSummaryHeader`
- `MilestoneTimeline`
- `RelatedJobsPanel`
- `TrustBadge`
- `ProjectWarningsPanel`

## 6.4 Estado y reglas

Estados actuales ya presentes en schema:

- `open`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

### Reglas sugeridas

- `cancelled` no vuelve a `in_progress` sin acción explícita de ops
- `completed` no permite nuevas milestone mutations normales
- `blocked` exige al menos una razón visible en UI

## 6.5 Errores importantes

- proyecto inexistente
- proyecto fuera del tenant
- proyecto visible pero no editable
- transición inválida de estado

## 6.6 Eventos sugeridos

- `project.created`
- `project.updated`
- `project.status_changed`
- `project.blocked`
- `project.completed`

## 6.7 Riesgos pequeños pero reales

- usar `jobId` como identidad de proyecto por conveniencia
- construir rutas con `slug` sin resolver colisiones
- overview que muestre datos stale de múltiples endpoints

---

## 7. Módulo Docs

## 7.1 Objetivo

Hacer de `WebAssistant` la experiencia documental principal, sin romper oficialidad del documento.

## 7.2 Tipos de documento recomendados

- `brief`
- `contract`
- `scope`
- `spec`
- `worklog_report`
- `incident_report`
- `evidence_note`
- `decision_memo`
- `ops_note`

## 7.3 APIs mínimas

### Read

- `GET /v1/projects/:id/documents`
- `GET /v1/documents/:id`
- `GET /v1/documents/:id/versions`
- `GET /v1/documents/:id/links`

### Write

- `POST /v1/projects/:id/documents`
- `PATCH /v1/documents/:id`
- `POST /v1/documents/:id/versions`
- `POST /v1/documents/:id/link-evidence`
- `POST /v1/documents/:id/publish`

## 7.4 Componentes UI

- `DocumentExplorer`
- `DocumentEditor`
- `DocumentVersionHistory`
- `DocumentPublishBar`
- `LinkedEvidencePanel`
- `DocumentTemplatePicker`
- `DocumentStatusPill`

## 7.5 Estados sugeridos de documento

- `DRAFT`
- `REVIEW`
- `PUBLISHED`
- `ARCHIVED`

### Reglas

- `DRAFT` editable por owner/editor
- `REVIEW` bloquea ciertos cambios estructurales
- `PUBLISHED` genera versión inmutable
- `ARCHIVED` solo lectura

## 7.6 Integración con negocio

Documentos con efecto operativo:

- contrato
- alcance aprobado
- memo de resolución
- evidencia documental

Estos deben tener:

- `documentId`
- `projectId`
- `entityLinks[]`
- `publishedVersionId`
- `createdBy`
- `updatedBy`
- `publishedAt`

## 7.7 Riesgos pequeños

- mezclar auto-save de borrador con publish oficial
- permitir editar una versión publicada por accidente
- no enlazar documento a `disputeId` o `milestoneId` cuando sí aplica

---

## 8. Módulo AI

## 8.1 Objetivo

Separar claramente:

- conversación
- sugerencia
- ejecución

## 8.2 Contratos existentes

Hoy existe un schema base en `packages/schemas/src/agent.schema.ts`:

- `agentType`
- `triggerType`
- `correlationId`
- `payload`

Agentes actuales:

- `pricing`
- `job-planner`
- `evidence-coach`
- `risk`
- `dispute`

## 8.3 Gap a cerrar

Faltan tipos de output y estado de run visibles para UI:

```ts
type AgentRunView = {
  id: string;
  projectId?: string | null;
  correlationId: string;
  agentType: "pricing" | "job-planner" | "evidence-coach" | "risk" | "dispute";
  triggerType: "manual" | "event" | "schedule";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  inputSummary?: string;
  outputSummary?: string;
  actionsSuggested?: CopilotAction[];
  createdAt: string;
  completedAt?: string | null;
};
```

## 8.4 APIs mínimas

- `POST /v1/agents/runs`
- `GET /v1/agents/runs/:id`
- `GET /v1/projects/:id/agent-context`
- `POST /v1/projects/:id/copilot/actions`
- `GET /v1/projects/:id/copilot/history`

## 8.5 Componentes UI

- `ProjectCopilotPanel`
- `ChatComposer`
- `SuggestedActionsList`
- `ActionApprovalModal`
- `AgentRunTimeline`
- `ContextSourcesPanel`
- `AIWarningBanner`

## 8.6 Reglas de seguridad

### Tipos de salida

- `answer_only`
- `answer_with_citations`
- `suggested_action`
- `executed_action`

### Regla crítica

Ninguna acción con impacto operativo se ejecuta automáticamente solo por texto del chat.

Debe haber:

- payload estructurado
- confirmación explícita
- RBAC
- auditoría

## 8.7 Errores importantes

- contexto insuficiente
- modelo no disponible
- acción no autorizada
- conflicto de estado del dominio

## 8.8 Riesgos pequeños

- que el chat lea proyecto A y ejecute en proyecto B
- que el usuario vea output viejo tras una mutación
- que no se muestren claramente fuentes y límites del copiloto

---

## 9. Módulo RAG

## 9.1 Objetivo

Hacer grounding de respuestas y búsqueda semántica sobre corpus autorizado.

## 9.2 Corpus inicial recomendado

- documents
- evidence metadata
- worklogs
- compliance docs
- dispute notes
- trust reasons
- contracts
- project summaries

## 9.3 Tipos de visibilidad

- `PRIVATE_PROJECT`
- `TEAM`
- `ORG`
- `PUBLIC`

## 9.4 APIs mínimas

- `POST /v1/rag/index-jobs`
- `GET /v1/projects/:id/knowledge`
- `POST /v1/projects/:id/search`
- `GET /v1/documents/:id/chunks`
- `GET /v1/evidence/:id`
- `GET /v1/projects/:id/corpus-status`

## 9.5 Componentes UI

- `SemanticSearchInput`
- `SearchResultList`
- `CitedAnswerCard`
- `ChunkPreviewDrawer`
- `CorpusFilterBar`
- `IndexStatusIndicator`

## 9.6 Estados recomendados de corpus

- `PENDING`
- `INDEXING`
- `READY`
- `FAILED`
- `STALE`

## 9.7 Reglas críticas

- cada chunk debe poder rastrearse a fuente original
- cada respuesta debe renderizar citas navegables
- no indexar contenido fuera de ACL efectiva

## 9.8 Riesgos pequeños

- indexar drafts no publicados cuando no corresponde
- respuestas sin citar fuente exacta
- chunks obsoletos tras update documental

---

## 10. Módulo Field Ops

## 10.1 Objetivo

Conectar operación física, evidencia y conocimiento a proyecto y disputas.

## 10.2 Base existente

La app local ya sugiere estas entidades:

- `FieldUnit`
- `WorklogEntry`
- `KnowledgeFact`
- `ComplianceDoc`
- `Vendor`

## 10.3 APIs mínimas

- `GET /v1/field-ops/units`
- `POST /v1/field-ops/units`
- `PUT /v1/field-ops/units/:id/status`
- `GET /v1/field-ops/worklogs`
- `POST /v1/field-ops/worklogs`
- `GET /v1/vendors`
- `GET /v1/compliance/docs`
- `POST /v1/worklogs/:id/facts`

## 10.4 Componentes UI

- `FieldUnitBoard`
- `UnitStatusBadge`
- `WorklogComposer`
- `WorklogFeed`
- `KnowledgeFactsPanel`
- `ComplianceStatusBoard`
- `VendorDirectory`
- `DailySummaryWidget`

## 10.5 Estados clave

Units:

- `PENDING`
- `IN_PROGRESS`
- `COMPLETE`
- `ON_HOLD`
- `CANCELLED`

Compliance docs:

- `MISSING`
- `PENDING`
- `APPROVED`
- `EXPIRED`

## 10.6 Reglas de negocio

- un `Worklog` debe ligar a `fieldUnitId`
- un `KnowledgeFact` debe tener `subject/predicate/object`
- compliance vencido debe disparar warning operacional
- `ON_HOLD` debe exponer blocker reason

## 10.7 Riesgos pequeños

- worklogs creados sin proyecto explícito
- facts duplicados por múltiples resúmenes IA
- vendors sin compliance vigente visibles como válidos

---

## 11. Módulo Payments

## 11.1 Objetivo

Dar visibilidad operativa sobre dinero, sin mover el cálculo financiero fuera de `SEMSE`.

## 11.2 Schemas ya presentes

`packages/schemas/src/payment.schema.ts` ya define:

- proveedores
- métodos
- depósito a escrow
- release
- webhook

Y `packages/schemas/src/project.schema.ts` ya define un `projectEscrowSummarySchema`.

## 11.3 APIs mínimas

- `GET /v1/projects/:id/payments`
- `GET /v1/projects/:id/escrow`
- `POST /v1/payments/deposit`
- `POST /v1/payments/approve`
- `POST /v1/payments/release`
- `POST /v1/payments/refund`
- `GET /v1/milestones/:id/payment-status`
- `GET /v1/payments/:id/audit`

## 11.4 Componentes UI

- `EscrowSummaryCard`
- `PaymentTimeline`
- `MilestonePaymentStatus`
- `ApprovePaymentModal`
- `ReleasePaymentModal`
- `RefundPaymentModal`
- `PaymentAuditDrawer`

## 11.5 Estados recomendados

Para visualización de pago:

- `PENDING_FUNDING`
- `FUNDED`
- `HELD`
- `APPROVAL_PENDING`
- `RELEASED`
- `REFUNDED`
- `FAILED`

## 11.6 Reglas clave

- release solo si milestone está aprobada o decisión especial lo permite
- refund solo con policy y estado elegible
- frontend jamás recalcula `available` de escrow

## 11.7 Explainability útil en WebAssistant

Mensajes útiles:

- “No se puede liberar porque la milestone no está aprobada”
- “Falta evidencia documental”
- “Existe disputa abierta”
- “El monto solicitado excede disponible”

## 11.8 Riesgos pequeños

- botones de acción visibles antes de cargar eligibility
- mostrar balance parcial mientras faltan transacciones
- race condition entre approve y release

---

## 12. Módulo Disputes

## 12.1 Objetivo

Ser el expediente transversal del conflicto.

## 12.2 Schemas ya presentes

`packages/schemas/src/dispute.schema.ts` define:

- creación por `projectId` o `jobId`
- asignación
- resolución

`packages/schemas/src/marketplace.schema.ts` ya define `disputeStateSchema`:

- `OPEN`
- `ASSIGNED`
- `UNDER_REVIEW`
- `RESOLVED`
- `REJECTED`

## 12.3 APIs mínimas

- `GET /v1/disputes`
- `GET /v1/disputes/:id`
- `POST /v1/disputes`
- `POST /v1/disputes/:id/assign`
- `POST /v1/disputes/:id/evidence`
- `POST /v1/disputes/:id/resolve`
- `GET /v1/disputes/:id/timeline`
- `GET /v1/disputes/:id/related-records`

## 12.4 Componentes UI

- `DisputeInbox`
- `DisputeHeader`
- `DisputeTimeline`
- `DisputeEvidenceGallery`
- `DisputeDecisionPanel`
- `RelatedPaymentsPanel`
- `RelatedDocumentsPanel`
- `CaseSummaryByAI`

## 12.5 Reglas críticas

- toda disputa debe tener reason canónica
- debe poder relacionarse con `projectId`, `jobId`, `milestoneId`
- toda resolución debe registrar actor y timestamp
- evidence no debe quedar desacoplada del caso

## 12.6 Integración transversal

La pantalla de disputa debe navegar a:

- contrato
- milestone
- payment status
- evidence
- worklogs
- trust snapshot

## 12.7 Riesgos pequeños

- resolver sin ver conjunto completo de evidencia
- intake incompleto que luego no se puede completar bien
- timeline que no muestre cambios de owner ni decisiones intermedias

---

## 13. Trust, Ops y observabilidad

## 13.1 Trust

Ya existe un `trustSnapshotSchema`.

Eso permite integrarlo visualmente como:

- trust badge en header del proyecto
- panel explicativo con reasons
- alertas preventivas en pagos y disputas

### Componentes sugeridos

- `TrustBadge`
- `TrustReasonsList`
- `TrustSignalsPanel`

### Casos de uso

- advertir riesgo alto antes de liberar fondos
- mostrar falta de contrato firmado
- mostrar milestone enviada sin evidencia

## 13.2 Ops

Los schemas de `ops` y `cortex` ya sugieren:

- dashboard
- runs
- audit
- risk scores
- warnings

### Recomendación

No poner esto como app separada visible al usuario estándar.

Ubicarlo como:

- módulo `Activity`
- o `Ops Console` solo para roles `OPS_ADMIN`

## 13.3 Observabilidad mínima

Cada mutación sensible debe registrar:

- `requestId`
- `actorUserId`
- `entityType`
- `entityId`
- `action`
- `timestamp`

Y cada pantalla debe poder mostrar:

- estado de carga
- error de dominio
- error de permisos
- estado stale
- timestamp de último refresh

---

## 14. Estados de carga, error y vacío en UI

## 14.1 Regla general

Cada módulo debe tener cinco estados explícitos:

- `loading`
- `ready`
- `empty`
- `error`
- `stale_refreshing`

## 14.2 Ejemplo por módulo

### Projects

- `loading`: skeleton del workspace
- `empty`: “No hay proyectos disponibles”
- `error`: “No pudimos cargar el proyecto”

### Docs

- `empty`: “Aún no hay documentos”
- `stale_refreshing`: “Sincronizando última versión”

### Payments

- `error`: distinguir provider error de rule violation

### Disputes

- `empty`: “No hay disputas abiertas”
- `error`: mostrar `requestId`

## 14.3 Pequeño detalle importante

Nunca mostrar un botón destructivo o irreversible sin haber cargado eligibility.

Ejemplo:

- `Release payment` debe estar disabled hasta tener status elegible real

---

## 15. Eventos de dominio recomendados

## 15.1 Catálogo mínimo

- `project.created`
- `project.updated`
- `project.status_changed`
- `document.created`
- `document.published`
- `document.linked_to_evidence`
- `agent.run_requested`
- `agent.run_completed`
- `agent.run_failed`
- `field_unit.created`
- `worklog.created`
- `knowledge_fact.created`
- `payment.funded`
- `payment.approved`
- `payment.released`
- `payment.refunded`
- `dispute.opened`
- `dispute.assigned`
- `dispute.resolved`
- `trust.snapshot_updated`

## 15.2 Para qué sirven

- refresco selectivo del frontend
- activity timeline unificado
- auditabilidad
- disparo de indexación RAG
- orquestación de agentes

---

## 16. Dependencias exactas entre módulos

## 16.1 Grafo real de dependencia

### Projects

Base de todo.

### Docs depende de

- `Projects`

### AI depende de

- `Projects`
- `Docs`
- opcionalmente `Field Ops`, `Payments`, `Disputes`

### Field Ops depende de

- `Projects`

### Payments depende de

- `Projects`
- `Milestones`
- `Contracts`
- opcionalmente `Trust`

### Disputes depende de

- `Projects`
- `Docs`
- `Evidence`
- `Payments`
- `Field Ops`

### RAG depende de

- `Docs`
- `Evidence`
- `Field Ops`
- `Disputes`
- `Projects`

## 16.2 Orden de ejecución refinado

### Fase P0

1. `Projects`
2. `Docs`
3. `AI`

### Fase P1

4. `Field Ops`
5. `Payments`
6. `Disputes`

### Fase P2

7. `RAG`
8. `Trust surfacing`
9. `Ops/Activity consolidation`

---

## 17. Checklist de implementación por módulo

## 17.1 Projects

- definir `ProjectView`
- exponer listado y detalle
- construir workspace unificado
- agregar header con trust/status
- unificar `projectId` en rutas

## 17.2 Docs

- definir `DocumentView` y `DocumentVersionView`
- implementar editor y publish
- enlazar docs a evidence/disputes/milestones
- bloquear edición de versiones publicadas

## 17.3 AI

- definir `AgentRunView`
- agregar chat con sources
- separar sugerencia de ejecución
- instrumentar `requestId` y auditoría

## 17.4 Field Ops

- exponer units y worklogs por proyecto
- permitir status changes trazables
- generar facts desde worklogs
- conectar a docs y disputes

## 17.5 Payments

- exponer escrow summary estable
- agregar eligibility de acciones
- separar provider failures de domain failures
- mostrar audit trail

## 17.6 Disputes

- intake con contexto
- timeline completo
- navegación a related records
- decision panel con policy awareness

## 17.7 RAG

- definir fuentes y ACL
- indexación incremental
- respuesta con citas navegables
- indicador de corpus stale

---

## 18. Riesgos de integración más finos

## 18.1 Riesgos técnicos

- drift de schemas entre apps
- payloads no versionados
- endpoints con shapes inconsistentes
- fetches paralelos sin coordinación de cache
- ausencia de idempotencia en acciones sensibles

## 18.2 Riesgos de UX

- el usuario no sabe si está editando draft u oficial
- el usuario no entiende por qué una acción está bloqueada
- se muestran datos no sincronizados entre paneles
- el chat parece autoritativo sin citar fuentes

## 18.3 Riesgos operativos

- pagos liberados con estado stale
- disputa resuelta sin corpus completo
- worklogs sin vínculo a proyecto o unidad
- documentos oficiales sin published version inmutable

---

## 19. Recomendación de implementación concreta

## 19.1 Primer corte útil

Entregar:

- `Projects` con workspace real
- `Docs` con editor + publish
- `AI` con runs auditables y acciones aprobables

Eso ya convierte a `WebAssistant` en una capa útil sin romper `SEMSE`.

## 19.2 Segundo corte

Entregar:

- `Field Ops`
- `Payments`
- `Disputes`

Con esto el workspace deja de ser solo documental y pasa a operar el proyecto.

## 19.3 Tercer corte

Entregar:

- `RAG`
- trust explanations
- activity consolidada

Esto eleva inteligencia y navegación transversal, pero solo tiene sentido con corpus y estados ya sólidos.

---

## 20. Conclusión técnica

La integración correcta es jerárquica y no simétrica.

`SEMSE` debe seguir siendo:

- sistema de verdad
- sistema de permisos
- sistema de auditoría
- sistema de efectos de negocio

`WebAssistant` debe ser:

- sistema de trabajo
- sistema de composición UX
- sistema de edición
- sistema de copiloto y búsqueda

El detalle importante no es solo conectar endpoints, sino cuidar las fronteras:

- qué se puede editar
- qué se puede ejecutar
- qué queda auditado
- qué es draft
- qué es oficial
- qué depende de `projectId`
- qué depende de permisos efectivos

Si estas fronteras se respetan, ambos productos pueden converger sin duplicarse ni contradecirse.
