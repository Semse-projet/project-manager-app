# Domain Model

## Objetivo

Definir el modelo completo de SEMSEproject como una sola maquina operativa.

Este documento no describe solo pantallas o modulos tecnicos.
Describe:

- dominios;
- agregados;
- estados;
- eventos;
- roles;
- reglas;
- agentes;
- vistas maestras;
- y el recorte del core lanzable.

## Precedencia

Este documento depende de:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)
- [`/home/yoni/labsemse/program/MASTERPLAN.md`](/home/yoni/labsemse/program/MASTERPLAN.md)
- [`README.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/README.md)
- [`DOMAIN_MODEL_MVP.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_MODEL_MVP.md)
- [`DOMAIN_INVARIANTS.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/DOMAIN_INVARIANTS.md)
- [`API_MODULE_MAP.md`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/foundation/API_MODULE_MAP.md)

Regla:

- `vision/` define la direccion maestra;
- `DOMAIN_MODEL.md` define la forma completa del sistema;
- `DOMAIN_MODEL_MVP.md` define el recorte minimo ejecutable;
- Prisma y `packages/schemas` implementan este dominio, no lo reinventan.

## Principio rector

SEMSEproject no es una coleccion de apps.

Es un sistema unico que coordina:

- trabajo real;
- evidencia;
- dinero;
- reputacion;
- disputas;
- operaciones;
- agentes;
- conocimiento;
- trazabilidad.

## Dominios principales

### 1. Auth

Responsable de:

- identidad;
- login;
- session;
- recovery;
- actor context;
- verificacion base.

### 2. Users / Organizations

Responsable de:

- usuarios;
- organizaciones;
- membresias;
- perfiles de cliente;
- perfiles profesionales;
- ownership canonico.

### 3. Jobs

Responsable de:

- creacion del trabajo;
- alcance;
- categoria;
- presupuesto;
- publicacion;
- asignacion;
- lifecycle comercial principal.

### 4. Contracts

Responsable de:

- terminos;
- firmas;
- versionado contractual;
- hash documental;
- cierre de acuerdo formal entre partes.

### 5. Milestones

Responsable de:

- secuenciar ejecucion;
- definir entregables parciales;
- controlar aprobaciones;
- habilitar liberaciones parciales.

### 6. Evidence

Responsable de:

- subir evidencia;
- metadata;
- checklist;
- validacion;
- trazabilidad para pagos, trust y disputa.

### 7. Payments / Escrow

Responsable de:

- retencion de fondos;
- ledger;
- liberaciones;
- refunds;
- fees;
- reconciliacion.

### 8. Disputes

Responsable de:

- abrir disputa;
- congelar efectos sensibles;
- revision;
- resolucion;
- outcome financiero y operativo.

### 9. Trust

Responsable de:

- señales de riesgo;
- reputacion por comportamiento;
- consistencia operativa;
- fraude;
- explicabilidad de confianza.

### 10. Agents

Responsable de:

- asistencia;
- scoring;
- soporte operativo;
- revision de evidencia;
- resumen de disputas;
- recomendaciones.

### 11. Field Ops

Responsable de:

- worklogs;
- seguimiento diario;
- reporting de campo;
- control surface;
- runbooks visibles;
- capacidad de intervención.

### 12. Knowledge / Docs

Responsable de:

- memoria institucional;
- hechos estables;
- procedencia;
- retrieval documental;
- consulta semantica futura.

### 12.b Operacion Asistida

Responsable de:

- identidad operativa del operador;
- memoria contextual por workspace;
- runtime agentic local;
- estado efimero regenerable;
- respaldo y continuidad operativa.

Regla:

- no es dominio de negocio primario;
- es capacidad transversal de ejecución y continuidad;
- se relaciona con `Agents`, `Knowledge`, `Admin / Ops Control` y `Auth`.

### 13. Admin / Ops Control

Responsable de:

- monitoreo;
- aprobaciones;
- alertas;
- excepciones;
- supervisión transversal.

## Capacidad transversal adicional

El dominio completo de `SEMSEproject` debe leerse con una capacidad transversal adicional:

- `Operacion Asistida`

Esta capacidad no sustituye ningún dominio principal, pero los atraviesa y condiciona:

- `Auth`
- `Agents`
- `Knowledge / Docs`
- `Admin / Ops Control`

Su taxonomía oficial es:

1. `operator_identity`
2. `workspace_memory`
3. `agent_runtime`
4. `ephemeral_runtime_state`
5. `backup_recovery`

## Roles oficiales

### Cliente

Puede:

- publicar jobs;
- revisar profesionales;
- aprobar o rechazar hitos;
- fondear escrow;
- abrir disputas;
- cerrar trabajos.

### Profesional / Worker

Puede:

- reservar o aceptar trabajos;
- ejecutar trabajo;
- subir evidencia;
- operar agenda;
- cobrar por milestones liberados;
- abrir disputa cuando aplique.

### Admin / Ops

Puede:

- supervisar;
- auditar;
- intervenir;
- resolver o escalar disputas;
- operar paneles internos;
- revisar señales de trust y riesgo.

### Agente interno

Puede:

- sugerir;
- resumir;
- detectar faltantes;
- evaluar patrones;
- proponer decisiones;

pero no debe asumir decisiones sensibles sin política explícita.

### Sistema / Worker process

Responsable de:

- expiraciones;
- colas;
- notificaciones;
- recalculos;
- automatizaciones;
- sincronizaciones.

## Agregados canonicos

### User

Representa una identidad humana o técnica dentro del sistema.

Campos base:

- `id`
- `email`
- `phone`
- `status`
- `primaryRole`
- `createdAt`
- `verifiedAt`

Eventos:

- `user.created`
- `user.verified`
- `user.suspended`

### Organization

Representa una unidad de ownership real.

Campos base:

- `id`
- `tenantId`
- `type`
- `name`
- `status`

Eventos:

- `organization.created`
- `organization.updated`

### Membership

Relaciona usuarios con organizaciones y roles.

Campos base:

- `id`
- `userId`
- `organizationId`
- `role`
- `status`

### ProfessionalProfile

Representa la identidad profesional operativa.

Campos base:

- `userId`
- `organizationId`
- `displayName`
- `membershipStatus`
- `licenseStatus`
- `insuranceStatus`
- `ratingAvg`
- `trustSnapshot`

### ClientProfile

Representa la identidad cliente operativa.

Campos base:

- `userId`
- `organizationId`
- `displayName`
- `ratingAvg`

### Job

Representa la unidad principal del flujo comercial.

Campos base:

- `id`
- `clientOrgId`
- `assignedProfessionalOrgId`
- `title`
- `category`
- `scope`
- `location`
- `budgetType`
- `budgetMin`
- `budgetMax`
- `state`
- `postedAt`
- `acceptedAt`
- `completedAt`

Estados canonicos:

- `DRAFT`
- `POSTED`
- `RESERVED`
- `ACCEPTED`
- `IN_PROGRESS`
- `WAITING_REVIEW`
- `PARTIALLY_PAID`
- `COMPLETED`
- `DISPUTED`
- `CANCELLED`

Eventos:

- `job.created`
- `job.posted`
- `job.reserved`
- `job.accepted`
- `job.started`
- `job.review_requested`
- `job.completed`
- `job.disputed`
- `job.cancelled`

Reglas:

- no `COMPLETED` con disputa abierta;
- no `COMPLETED` con hitos pendientes incompatibles;
- no `CANCELLED` con conflicto financiero sin política de cierre.

### Contract

Representa el acuerdo formal asociado al job.

Campos base:

- `id`
- `jobId`
- `clientOrgId`
- `professionalOrgId`
- `termsJson`
- `version`
- `signedClientAt`
- `signedProfessionalAt`
- `pdfUrl`
- `documentHash`

Eventos:

- `contract.generated`
- `contract.client_signed`
- `contract.professional_signed`
- `contract.fully_executed`

### Milestone

Representa una unidad verificable de avance y pago parcial.

Campos base:

- `id`
- `jobId`
- `sequence`
- `title`
- `description`
- `amountCents`
- `state`
- `submittedAt`
- `approvedAt`
- `paidAt`

Estados:

- `DRAFT`
- `READY`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `PAID`

Eventos:

- `milestone.created`
- `milestone.submitted`
- `milestone.approved`
- `milestone.rejected`
- `milestone.paid`

Reglas:

- no `APPROVED` sin revisión válida;
- no `PAID` sin release financiero válido;
- no `SUBMITTED` sin evidencia mínima según política.

### Evidence

Representa prueba estructurada asociada a un milestone o job.

Campos base:

- `id`
- `jobId`
- `milestoneId`
- `kind`
- `storageUrl`
- `description`
- `metadataJson`
- `checklistJson`
- `uploadedBy`
- `uploadedAt`
- `validationState`

Estados:

- `UPLOADED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`

Eventos:

- `evidence.uploaded`
- `evidence.validated`
- `evidence.rejected`

### PaymentEscrow

Representa la cuenta de retención y movimiento financiero del job.

Campos base:

- `id`
- `jobId`
- `provider`
- `status`
- `currency`
- `totalAmountCents`
- `fundedCents`
- `releasedCents`
- `refundedCents`

Estados:

- `PENDING`
- `FUNDED`
- `HELD`
- `PARTIALLY_RELEASED`
- `RELEASED`
- `DISPUTED`
- `REFUNDED`

Eventos:

- `payment.held`
- `payment.funded`
- `payment.released`
- `payment.refunded`
- `payment.reconciled`

### PaymentTransaction

Representa una transacción puntual del escrow.

Campos base:

- `id`
- `escrowId`
- `milestoneId`
- `type`
- `amountCents`
- `providerRef`
- `status`
- `createdAt`

Tipos:

- `FUND`
- `RELEASE`
- `HOLDBACK`
- `FEE`
- `REFUND`

### Dispute

Representa una excepción formal del flujo.

Campos base:

- `id`
- `jobId`
- `milestoneId`
- `openedByOrgId`
- `reason`
- `status`
- `resolutionType`
- `openedAt`
- `resolvedAt`

Estados:

- `OPEN`
- `UNDER_REVIEW`
- `RESOLVED`
- `CANCELLED`

Eventos:

- `dispute.opened`
- `dispute.review_started`
- `dispute.resolved`

### TrustProfile

Representa el agregado explicable de señales de confianza.

Campos base:

- `id`
- `organizationId`
- `completionRate`
- `disputeRate`
- `firstPassApprovalRate`
- `responseTimeAvg`
- `riskFlagsJson`
- `trustScore`
- `updatedAt`

Eventos:

- `trust.recalculated`
- `trust.flag_added`
- `trust.flag_cleared`

### AgentAction

Representa una ejecución, recomendación o intervención de un agente.

Campos base:

- `id`
- `agentType`
- `contextType`
- `entityType`
- `entityId`
- `inputJson`
- `outputJson`
- `confidence`
- `status`
- `createdAt`

Eventos:

- `agent.action.logged`
- `agent.recommendation.accepted`
- `agent.recommendation.rejected`

### AuditLog

Representa trazabilidad append-only.

Campos base:

- `id`
- `actorType`
- `actorId`
- `entityType`
- `entityId`
- `action`
- `beforeJson`
- `afterJson`
- `reason`
- `createdAt`

### Notification

Representa una notificación del sistema.

Campos base:

- `id`
- `recipientUserId`
- `type`
- `title`
- `message`
- `readAt`
- `metadataJson`
- `createdAt`

### KnowledgeRecord

Representa conocimiento persistente con procedencia.

Campos base:

- `id`
- `sourceType`
- `sourceId`
- `jobId`
- `organizationId`
- `statement`
- `tagsJson`
- `provenanceJson`
- `createdAt`

## Flujos principales obligatorios

1. publicar trabajo
2. reservar o aceptar trabajo
3. ejecutar trabajo
4. subir evidencia
5. aprobar o rechazar milestone
6. liberar pago
7. abrir disputa
8. resolver disputa
9. recalcular trust
10. cerrar trabajo

## Eventos transversales del sistema

Catalogo minimo base:

- `user.verified`
- `job.created`
- `job.posted`
- `job.assigned`
- `milestone.created`
- `milestone.submitted`
- `evidence.uploaded`
- `evidence.validated`
- `payment.held`
- `payment.released`
- `dispute.opened`
- `dispute.resolved`
- `trust.recalculated`
- `agent.action.logged`
- `notification.queued`

## Capa de agentes

Agentes previstos:

- `PricingAgent`
- `TrustMatchAgent`
- `EvidenceCoachAgent`
- `DisputeAgent`
- `MarketCheckAgent`
- `OpsAgent`
- `OrchestratorAgent`

### Regla operativa

Todo agente debe definir:

1. qué consume
2. qué produce
3. qué nivel de autonomía tiene
4. qué requiere override humano
5. qué queda auditado

## Vistas maestras del producto

### Cliente

- publish job
- dashboard
- milestone review
- escrow
- professionals
- disputes

### Worker

- dashboard
- agenda
- active jobs
- evidence
- payouts
- history

### Admin / Ops

- control surface
- disputes
- trust / flags
- audit
- metrics
- knowledge / runbooks

## Trazabilidad obligatoria

El modelo debe poder responder siempre:

- quién cambió esto
- cuándo
- por qué
- con qué evidencia
- con qué agente
- con qué efecto

## Core lanzable

El modelo completo no implica construir todo al mismo tiempo.

El core lanzable mínimo incluye:

### Backend

- auth real
- jobs
- milestones
- evidence
- escrow básico
- disputes mínimo
- trust básico

### Frontend

- publish job
- client dashboard
- worker dashboard
- evidence flow
- escrow flow básico
- agenda base

### Plataforma

- `packages/ui` vivo
- contratos unificados
- API como fuente oficial
- auditabilidad mínima

## Artefactos que este documento debe habilitar

1. `packages/schemas/*`
2. `packages/db/prisma/schema.prisma`
3. `apps/api`
4. `packages/ui`
5. `STATE_MACHINES.md`
6. `EVENT_CATALOG.md`
7. `API_BOUNDARIES.md`
8. `LAUNCH_CORE.md`

## Secuencia práctica de implementación

1. cerrar este modelo de dominio
2. convertirlo en `packages/schemas`
3. convertirlo en Prisma
4. alinear `apps/api`
5. construir `packages/ui`
6. migrar UX desde `src/` a `apps/web`
7. conectar agentes y auditoría
8. cerrar el core lanzable

## Regla final

Si una parte del sistema no puede mapearse claramente a:

- un dominio;
- una entidad;
- un estado;
- un evento;
- una regla;

entonces todavia no forma parte del modelo completo de SEMSEproject.
