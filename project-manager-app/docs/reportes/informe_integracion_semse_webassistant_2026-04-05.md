# Informe de Integración SEMSE + WebAssistant

Fecha: 2026-04-05

## Objetivo

Definir un mapa exacto de integración entre:

- `SEMSE` como sistema de dominio y datos operativos
- `WebAssistant` como capa de trabajo, conocimiento, copiloto y navegación unificada

Principios acordados:

1. `SEMSE` mantiene dominio y datos operativos.
2. `WebAssistant` consume APIs de `SEMSE`.
3. Se unifica identidad, navegación y modelo de proyecto.

## Arquitectura objetivo

### Roles de cada plataforma

#### SEMSE

Responsable de:

- proyectos canónicos
- jobs
- milestones
- field ops
- evidence
- knowledge facts
- trust
- contracts
- payments / escrow
- disputes
- agent runs auditables
- permisos y contexto organizacional

#### WebAssistant

Responsable de:

- workspace principal del usuario
- navegación unificada por proyecto
- editor y documentación
- experiencia conversacional de IA
- búsqueda y grounding RAG
- activity center
- vistas operativas y paneles compuestos
- preferencias de UI y productividad

### Entidad canónica compartida

Entidad raíz: `Project`

Campos mínimos compartidos:

- `projectId`
- `tenantId`
- `orgId`
- `name`
- `slug`
- `type`
- `status`
- `clientId`
- `ownerUserId`
- `assignedPros[]`
- `budget`
- `currency`
- `createdAt`
- `updatedAt`

Regla:

- `WebAssistant` no crea una entidad paralela de proyecto.
- Todo módulo opera sobre el `projectId` de `SEMSE`.

### Identidad unificada

Contexto mínimo requerido en requests desde `WebAssistant` a `SEMSE`:

- `x-tenant-id`
- `x-org-id`
- `x-user-id`
- `x-roles`

Dirección recomendada:

- auth centralizada
- cookie de sesión o token unificado
- `SEMSE` como source of truth de permisos efectivos

## Tabla de implementación

| Módulo | API requerida | Componentes UI | Source of truth | Riesgos | Prioridad |
|---|---|---|---|---|---|
| Projects | `GET /v1/projects`, `GET /v1/projects/:id`, `POST /v1/projects`, `PATCH /v1/projects/:id`, `GET /v1/projects/:id/jobs`, `GET /v1/projects/:id/milestones` | listado de proyectos, dashboard de proyecto, overview, timeline, panel lateral de contexto, filtros, quick actions | `SEMSE` para proyecto, jobs y milestones. `WebAssistant` solo guarda preferencias de vista | duplicación de modelo de proyecto, divergencia de estados, filtros apoyados en campos no canónicos | `P0` |
| Docs | `GET /v1/projects/:id/documents`, `POST /v1/projects/:id/documents`, `GET /v1/documents/:id`, `POST /v1/documents/:id/versions`, `POST /v1/documents/:id/link-evidence` | editor rico, markdown editor, visor de documento, versionado, plantillas, panel de referencias, browser documental por proyecto | metadata documental y relaciones en `SEMSE`; preferencias editoriales y drafts transitorios en `WebAssistant` | shadow copies del documento, problemas de versionado, documentos sensibles sin trazabilidad | `P0` |
| AI | `POST /v1/agents/runs`, `GET /v1/agents/runs/:id`, `GET /v1/projects/:id/agent-context`, `POST /v1/projects/:id/copilot/actions` | chat por proyecto, historial de conversaciones, streaming, action composer, approval modals, panel de contexto de proyecto | `SEMSE` para runs, contexto, acciones y auditoría; `WebAssistant` para UX conversacional e historial de sesión no crítico | acciones con efecto de negocio sin confirmación, drift entre contexto del chat y estado real del proyecto | `P0` |
| RAG | `POST /v1/rag/index-jobs`, `GET /v1/projects/:id/knowledge`, `POST /v1/projects/:id/search`, `GET /v1/documents/:id/chunks`, `GET /v1/evidence/:id` | buscador semántico, respuestas con citas, visor de chunks, source cards, filtros por corpus, pinning de contexto al chat | corpus, indexación, ACL y visibilidad en `SEMSE`; ranking y experiencia de búsqueda en `WebAssistant` | fuga de datos por ACL mal aplicada, grounding sobre corpus incompleto, latencia de indexación | `P2` |
| Field Ops | `GET /v1/field-ops/units`, `POST /v1/field-ops/units`, `PUT /v1/field-ops/units/:id/status`, `GET /v1/field-ops/worklogs`, `POST /v1/field-ops/worklogs`, `GET /v1/vendors`, `GET /v1/compliance/docs` | tablero de unidades, formularios móviles, worklogs, timeline operativo, compliance board, vendor cards, resumen IA de frente de obra | `SEMSE` para unidades, worklogs, compliance y vendors; `WebAssistant` para layout, reporting y resúmenes | offline parcial, inconsistencia en estados de obra, workflows incompletos entre worklogs y disputas | `P1` |
| Payments | `GET /v1/projects/:id/payments`, `GET /v1/projects/:id/escrow`, `POST /v1/payments/approve`, `POST /v1/payments/release`, `POST /v1/payments/refund`, `GET /v1/milestones/:id/payment-status` | payment timeline, escrow panel, approval UI, release/refund workflows, alertas de bloqueo, explicación IA de estado financiero | `SEMSE` para ledger, escrow, approvals y estados; `WebAssistant` solo explica y renderiza | cálculos financieros en frontend, acciones irreversibles sin policy gate, mala trazabilidad de aprobaciones | `P1` |
| Disputes | `GET /v1/disputes`, `GET /v1/disputes/:id`, `POST /v1/disputes`, `POST /v1/disputes/:id/evidence`, `POST /v1/disputes/:id/decision`, `GET /v1/disputes/:id/timeline` | intake wizard, expediente de disputa, timeline del caso, evidence viewer, decision console, resumen IA del caso | `SEMSE` para estados, decisiones, evidencia y timeline oficial; `WebAssistant` para intake, revisión y análisis transversal | decisiones sin evidencia suficiente, timeline incompleto, conflicto entre contrato, evidencia y pagos | `P1` |

## Orden recomendado de implementación

### P0

- `Projects`
- `Docs`
- `AI`

Motivo:

- unifican entidad raíz, flujo principal y capa de trabajo
- reducen duplicación estructural temprano
- permiten conectar `WebAssistant` al dominio real sin tocar todavía módulos más sensibles

### P1

- `Field Ops`
- `Payments`
- `Disputes`

Motivo:

- ya dependen de un `Project Workspace` estable
- requieren mejor trazabilidad y reglas de negocio
- tienen mayor impacto operativo y legal

### P2

- `RAG`

Motivo:

- depende de corpus ya integrado
- requiere ACL, indexación y chunks bien definidos
- conviene activarlo cuando `Docs`, `Evidence` y `Field Ops` ya estén consolidados

## Reglas de source of truth

### SEMSE es source of truth para

- identidad efectiva y roles
- proyecto y estados oficiales
- jobs y milestones
- evidence y compliance
- field ops
- payments / escrow
- disputes
- contratos
- knowledge facts oficiales
- agent runs auditables

### WebAssistant es source of truth para

- layout y preferencias de usuario
- estado visual del workspace
- drafts transitorios no oficiales
- sesiones de UI
- composición de vistas y paneles
- búsqueda y experiencia de productividad

## Reglas de integración por módulo

### Projects

- Unificar todas las vistas sobre `projectId`.
- El listado principal de `WebAssistant` debe cargar desde `SEMSE`.
- Los jobs y milestones deben mostrarse como subrecursos del proyecto.

### Docs

- Todo documento con impacto de negocio debe registrarse en `SEMSE`.
- El editor de `WebAssistant` no puede convertirse en almacenamiento oficial aislado.

### AI

- Toda acción con efecto real debe pasar por una API de acción explícita.
- Todo run ejecutado debe quedar auditado en `SEMSE`.

### RAG

- Solo indexar corpus autorizado por visibilidad y proyecto.
- Toda respuesta debe poder citar documentos, evidence o worklogs concretos.

### Field Ops

- `Worklogs`, `KnowledgeFacts` y `ComplianceDocs` deben poder relacionarse con `Project`, `FieldUnit` y potencialmente `Dispute`.

### Payments

- Nunca computar estados finales en frontend.
- Toda transición de aprobación o liberación debe residir en `SEMSE`.

### Disputes

- Debe existir navegación cruzada desde disputa hacia pagos, hitos, contratos, evidence y worklogs.
- La decisión oficial solo puede emitirse desde `SEMSE`.

## DTOs compartidos recomendados

Se recomienda consolidar estos contratos en `packages/schemas`:

- `ProjectView`
- `ProjectSummary`
- `DocumentView`
- `DocumentVersionView`
- `KnowledgeFactView`
- `FieldUnitView`
- `WorklogView`
- `ComplianceDocView`
- `PaymentView`
- `EscrowView`
- `DisputeView`
- `AgentRunView`

## Rutas unificadas recomendadas en WebAssistant

- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/docs`
- `/projects/:projectId/ai`
- `/projects/:projectId/rag`
- `/projects/:projectId/field-ops`
- `/projects/:projectId/payments`
- `/projects/:projectId/disputes`

## Siguiente corte de ejecución sugerido

### Sprint 1

- canonizar `Project`
- listar proyectos desde `SEMSE`
- abrir workspace de proyecto
- integrar `Docs`
- integrar `AI`

### Sprint 2

- conectar `Field Ops`
- conectar `Payments`
- conectar `Disputes`

### Sprint 3

- montar `RAG`
- indexación selectiva por proyecto
- respuestas con citas

## Conclusión

La integración viable no es fusionar dos productos equivalentes, sino establecer una jerarquía clara:

- `SEMSE` como backend de dominio y registro oficial
- `WebAssistant` como experiencia de trabajo y copiloto

La clave es evitar duplicar:

- proyecto
- auth
- estados de negocio
- documentos oficiales
- lógica de pagos y disputas

La ruta de menor riesgo es implementar primero `Projects`, `Docs` y `AI`, y dejar `RAG` para una vez que el corpus de `SEMSE` ya esté estructurado y gobernado por ACL.
