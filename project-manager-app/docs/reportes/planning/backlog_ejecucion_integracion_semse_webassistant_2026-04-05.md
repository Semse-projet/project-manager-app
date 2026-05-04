# Backlog de Ejecución Integración SEMSE + WebAssistant

Fecha: 2026-04-05

Documentos base:

- [informe_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/informe_integracion_semse_webassistant_2026-04-05.md)
- [blueprint_detallado_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/blueprint_detallado_integracion_semse_webassistant_2026-04-05.md)

## Objetivo

Traducir el diseño de integración en un backlog técnico real, priorizado y ejecutable.

## Convenciones

### Prioridades

- `P0`: bloquea convergencia de producto
- `P1`: habilita operación real del workspace
- `P2`: mejora inteligencia, cobertura o escala

### Tipos de trabajo

- `API`
- `Schema`
- `UI`
- `Infra`
- `Auth`
- `Data`
- `QA`
- `Observability`

---

## Sprint 0: Fundaciones de integración

Objetivo:

- dejar listas las bases para que `WebAssistant` pueda consumir `SEMSE` sin ambigüedad de identidad, proyecto o contratos

### Ticket S0-01

- Título: Canonizar identidad y contexto de request
- Tipo: `Auth`
- Prioridad: `P0`
- Entregable:
  - contrato único de contexto
  - propagación consistente de:
    - `x-tenant-id`
    - `x-org-id`
    - `x-user-id`
    - `x-roles`
    - `x-request-id`
- Criterio de aceptación:
  - toda request de `WebAssistant` a `SEMSE` incluye headers mínimos
  - `SEMSE` rechaza requests sin contexto requerido
  - errores de auth y permisos tienen código estable
- Riesgos:
  - doble sesión
  - drift de roles

### Ticket S0-02

- Título: Definir `ProjectView` y `ProjectSummary` canónicos
- Tipo: `Schema`
- Prioridad: `P0`
- Entregable:
  - ampliar schemas de proyecto en `packages/schemas`
  - distinguir shape de lista y shape de detalle
- Criterio de aceptación:
  - `ProjectSummary` sirve para listado
  - `ProjectView` sirve para workspace
  - ambos compilan y son consumibles por API y web
- Dependencias:
  - ninguna

### Ticket S0-03

- Título: Normalizar envelope de API y errores
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - respuesta estándar `data/meta`
  - error estándar `error.code/message/requestId`
- Criterio de aceptación:
  - endpoints nuevos siguen contrato estándar
  - frontend puede distinguir `FORBIDDEN`, `CONFLICT`, `VALIDATION_ERROR`
- Riesgos:
  - migración parcial con respuestas mixtas

### Ticket S0-04

- Título: Definir estrategia de idempotencia para mutaciones sensibles
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - soporte de `x-idempotency-key`
  - persistencia o deduplicación mínima
- Criterio de aceptación:
  - `agents/runs`, `payments`, `disputes` y `document versions` toleran reintentos seguros

### Ticket S0-05

- Título: Diseñar rutas unificadas por `projectId`
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - convención de rutas
  - layout de workspace de proyecto
- Criterio de aceptación:
  - navegación propuesta validada
  - todos los módulos cuelgan del proyecto

---

## Sprint 1: Projects

Objetivo:

- hacer que `WebAssistant` use proyectos reales de `SEMSE`

### Ticket S1-01

- Título: Exponer `GET /v1/projects`
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - listado paginable o simple de proyectos
  - filtros por estado y contexto organizacional
- Criterio de aceptación:
  - devuelve `ProjectSummary[]`
  - respeta tenant y RBAC

### Ticket S1-02

- Título: Exponer `GET /v1/projects/:id`
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - detalle expandido del proyecto
  - summary operativo básico
- Criterio de aceptación:
  - devuelve `ProjectView`
  - incluye estado, ids relacionados y budget cuando exista

### Ticket S1-03

- Título: Exponer subrecursos de jobs y milestones por proyecto
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - `GET /v1/projects/:id/jobs`
  - `GET /v1/projects/:id/milestones`
- Criterio de aceptación:
  - frontend arma overview sin inventar joins locales

### Ticket S1-04

- Título: Implementar `ProjectsPage` en WebAssistant consumiendo SEMSE
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - listado real
  - filtros
  - estados `loading/empty/error`
- Criterio de aceptación:
  - desaparece dataset mock/local para proyectos

### Ticket S1-05

- Título: Implementar `ProjectWorkspaceLayout`
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - header contextual
  - sidebar por módulos
  - panel de warnings
- Criterio de aceptación:
  - cualquier módulo puede montarse dentro del workspace

### Ticket S1-06

- Título: Instrumentar observabilidad de requests de Projects
- Tipo: `Observability`
- Prioridad: `P1`
- Entregable:
  - request ids visibles en logs
  - métricas básicas de errores

---

## Sprint 2: Docs

Objetivo:

- convertir documentos en un módulo oficial del proyecto

### Ticket S2-01

- Título: Definir `DocumentView` y `DocumentVersionView`
- Tipo: `Schema`
- Prioridad: `P0`
- Entregable:
  - schemas compartidos para metadata, status, versionado y links

### Ticket S2-02

- Título: Exponer listado y detalle de documentos por proyecto
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - `GET /v1/projects/:id/documents`
  - `GET /v1/documents/:id`

### Ticket S2-03

- Título: Exponer versionado de documentos
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - `POST /v1/documents/:id/versions`
  - `GET /v1/documents/:id/versions`
- Criterio de aceptación:
  - se puede publicar versión inmutable

### Ticket S2-04

- Título: Implementar `DocumentExplorer`
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - árbol/lista de documentos por proyecto
  - filtros por tipo y estado

### Ticket S2-05

- Título: Implementar `DocumentEditor` con separación draft/published
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - edición rica
  - publish bar
  - warnings de oficialidad
- Riesgos:
  - que el usuario no entienda qué es borrador y qué es oficial

### Ticket S2-06

- Título: Enlazar documentos con evidence y disputes
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - `POST /v1/documents/:id/link-evidence`
  - relaciones navegables desde frontend

---

## Sprint 3: AI

Objetivo:

- acoplar la consola AI a runs auditables y acciones aprobables

### Ticket S3-01

- Título: Definir `AgentRunView` y estados de ejecución
- Tipo: `Schema`
- Prioridad: `P0`
- Entregable:
  - shape de run, status y resúmenes

### Ticket S3-02

- Título: Exponer historial y detalle de runs de agente por proyecto
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - `GET /v1/projects/:id/copilot/history`
  - `GET /v1/agents/runs/:id`

### Ticket S3-03

- Título: Exponer contexto de proyecto para copiloto
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - `GET /v1/projects/:id/agent-context`

### Ticket S3-04

- Título: Implementar chat de proyecto con historial y fuentes
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - chat UI
  - runs timeline
  - sources panel

### Ticket S3-05

- Título: Implementar approval flow para acciones AI
- Tipo: `UI`
- Prioridad: `P0`
- Entregable:
  - modal de confirmación
  - diff/payload preview
  - feedback de ejecución

### Ticket S3-06

- Título: Auditar acciones AI con requestId y actor
- Tipo: `Observability`
- Prioridad: `P1`
- Entregable:
  - logs y audit trail mínimo

---

## Sprint 4: Field Ops

Objetivo:

- integrar operación de campo dentro del workspace unificado

### Ticket S4-01

- Título: Definir views compartidas para units, worklogs, compliance y vendors
- Tipo: `Schema`
- Prioridad: `P1`
- Entregable:
  - `FieldUnitView`
  - `WorklogView`
  - `ComplianceDocView`
  - `VendorView`

### Ticket S4-02

- Título: Exponer APIs de units y worklogs por proyecto
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - filtros por proyecto
  - mutaciones de status

### Ticket S4-03

- Título: Integrar `Field Ops` page de WebAssistant con API real
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - board de unidades
  - feed de worklogs
  - compliance board

### Ticket S4-04

- Título: Derivar knowledge facts desde worklogs
- Tipo: `API`
- Prioridad: `P2`
- Entregable:
  - endpoint o proceso para facts estructurados

### Ticket S4-05

- Título: Conectar bloqueos operativos con warnings del proyecto
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - `ProjectWarningsPanel` consume blockers de campo

---

## Sprint 5: Payments

Objetivo:

- mostrar finanzas del proyecto con seguridad operativa

### Ticket S5-01

- Título: Definir `PaymentView`, `EscrowView` y `MilestonePaymentStatusView`
- Tipo: `Schema`
- Prioridad: `P1`
- Entregable:
  - contratos compartidos para timeline y acciones

### Ticket S5-02

- Título: Exponer escrow summary y payment timeline
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - `GET /v1/projects/:id/escrow`
  - `GET /v1/projects/:id/payments`

### Ticket S5-03

- Título: Exponer eligibility de acciones financieras
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - respuestas incluyen `allowedActions`
  - razones de bloqueo

### Ticket S5-04

- Título: Implementar panel de pagos en WebAssistant
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - summary
  - timeline
  - modales approve/release/refund

### Ticket S5-05

- Título: Integrar explicaciones AI de estado financiero
- Tipo: `UI`
- Prioridad: `P2`
- Entregable:
  - mensajes claros sobre bloqueos y faltantes

---

## Sprint 6: Disputes

Objetivo:

- convertir la disputa en expediente transversal navegable

### Ticket S6-01

- Título: Definir `DisputeView`, `DisputeTimelineEvent` y `RelatedRecordsView`
- Tipo: `Schema`
- Prioridad: `P1`
- Entregable:
  - shape canónico para inbox y detalle

### Ticket S6-02

- Título: Exponer APIs de inbox, detalle y timeline de disputas
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - `GET /v1/disputes`
  - `GET /v1/disputes/:id`
  - `GET /v1/disputes/:id/timeline`

### Ticket S6-03

- Título: Exponer `related-records` para disputa
- Tipo: `API`
- Prioridad: `P1`
- Entregable:
  - pagos
  - docs
  - evidence
  - milestones
  - worklogs

### Ticket S6-04

- Título: Implementar `DisputeInbox` y `DisputeDetailPage`
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - expediente
  - timeline
  - evidence viewer

### Ticket S6-05

- Título: Integrar resumen AI del caso con grounding
- Tipo: `UI`
- Prioridad: `P2`
- Entregable:
  - resumen con citas a evidencia y docs

---

## Sprint 7: RAG

Objetivo:

- agregar búsqueda semántica y grounding confiable

### Ticket S7-01

- Título: Definir corpus y ACL de indexación
- Tipo: `Data`
- Prioridad: `P2`
- Entregable:
  - fuentes iniciales
  - reglas de visibilidad
  - estados de corpus

### Ticket S7-02

- Título: Exponer búsqueda semántica por proyecto
- Tipo: `API`
- Prioridad: `P2`
- Entregable:
  - `POST /v1/projects/:id/search`
  - respuestas con citas

### Ticket S7-03

- Título: Exponer chunks y estado de corpus
- Tipo: `API`
- Prioridad: `P2`
- Entregable:
  - `GET /v1/documents/:id/chunks`
  - `GET /v1/projects/:id/corpus-status`

### Ticket S7-04

- Título: Implementar `RAGToolsPage` conectada a SEMSE
- Tipo: `UI`
- Prioridad: `P2`
- Entregable:
  - semantic search
  - cited answers
  - chunk previews

### Ticket S7-05

- Título: Conectar RAG al chat AI del proyecto
- Tipo: `UI`
- Prioridad: `P2`
- Entregable:
  - pinning de fuentes
  - answers grounded

---

## Backlog transversal

### Ticket XT-01

- Título: Consolidar DTOs en `packages/schemas`
- Tipo: `Schema`
- Prioridad: `P0`
- Entregable:
  - contratos compartidos para todos los módulos

### Ticket XT-02

- Título: Implementar client SDK tipado para consumir SEMSE
- Tipo: `API`
- Prioridad: `P0`
- Entregable:
  - capa única de consumo HTTP en `WebAssistant`

### Ticket XT-03

- Título: Definir cache keys y políticas de invalidación
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - invalidación por proyecto, documento, disputa y pago

### Ticket XT-04

- Título: Estandarizar estados de carga, vacío y error
- Tipo: `UI`
- Prioridad: `P1`
- Entregable:
  - componentes compartidos de skeleton, empty state y error banner

### Ticket XT-05

- Título: Instrumentar activity timeline unificado
- Tipo: `Observability`
- Prioridad: `P2`
- Entregable:
  - stream transversal por proyecto

### Ticket XT-06

- Título: QA end-to-end de workspace unificado
- Tipo: `QA`
- Prioridad: `P1`
- Entregable:
  - escenarios e2e por módulo

---

## Matriz de dependencias

| Módulo | Depende de |
|---|---|
| Projects | Auth, schemas base |
| Docs | Projects |
| AI | Projects, Docs |
| Field Ops | Projects |
| Payments | Projects, milestones, contracts |
| Disputes | Projects, Docs, Evidence, Payments, Field Ops |
| RAG | Docs, Evidence, Field Ops, Disputes, AI |

---

## Definition of Done por ticket

Un ticket se considera terminado solo si cumple:

- contrato compartido definido o actualizado
- endpoint o componente implementado
- manejo de `loading/empty/error`
- RBAC respetado
- logs con `requestId`
- pruebas mínimas del caso feliz y un error relevante
- documentación actualizada si cambia interfaz pública

---

## Riesgos de ejecución

### Riesgo 1

- integrar UI antes de tener contrato canónico
- efecto: retrabajo alto y adapters temporales

### Riesgo 2

- implementar RAG antes de consolidar Docs/Evidence
- efecto: corpus débil y respuestas sin grounding confiable

### Riesgo 3

- permitir acciones AI antes de approval flow
- efecto: riesgo operativo directo

### Riesgo 4

- payments sin eligibility estructurada
- efecto: UX engañosa y errores de negocio en frontend

---

## Orden recomendado definitivo

1. Sprint 0
2. Sprint 1
3. Sprint 2
4. Sprint 3
5. Sprint 4
6. Sprint 5
7. Sprint 6
8. Sprint 7

## Resumen ejecutivo

La secuencia correcta es:

- primero canonizar identidad, proyecto y contratos
- luego integrar `Projects`, `Docs` y `AI`
- después llevar operación real con `Field Ops`, `Payments` y `Disputes`
- por último activar `RAG` como multiplicador de inteligencia

Esta ruta reduce retrabajo y evita que `WebAssistant` termine duplicando el dominio que ya debe residir en `SEMSE`.
