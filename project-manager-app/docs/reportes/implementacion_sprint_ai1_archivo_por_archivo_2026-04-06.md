# Implementacion Sprint AI-1 Archivo por Archivo - 2026-04-06

## Alcance

Sprint objetivo:

- `evento de dominio -> AgentRun automático`

Estado:

- implementado a nivel de wiring interno del API;
- pendiente validación de compilación completa cuando el workspace tenga dependencias locales operativas.

---

## Mapa exacto por archivo

## 1. Núcleo de eventos

### `apps/api/src/modules/domain-events/domain-events.module.ts`

Responsabilidad:

- registrar el módulo interno de eventos;
- importar `PrismaModule` y `AgentsModule`;
- exportar `DomainEventBus` para consumo en módulos de dominio.

### `apps/api/src/modules/domain-events/domain-event-bus.service.ts`

Responsabilidad:

- recibir un `SemseEvent`;
- validarlo con `semseEventSchema`;
- registrar auditoría de emisión;
- delegar el enrutamiento al `AgentTriggerRouter`.

Entrada:

- `SemseEvent`
- contexto de request: `tenantId`, `orgId`, `userId`, `requestId`

Salida:

- lista de `AgentRun` creados por el router.

### `apps/api/src/modules/domain-events/agent-trigger-router.service.ts`

Responsabilidad:

- tomar `event.triggers` o `EVENT_AGENT_MAP[event.type]`;
- filtrar triggers internos válidos del runtime;
- crear `AgentRun` vía `AgentsService.create()`;
- guardar input contextual del evento.

Decisión importante:

- se ignoran triggers no runtime como `notification` y `audit`;
- solo se convierten en runs los agentes reales del catálogo.

---

## 2. Agentes

### `apps/api/src/modules/agents/agents.module.ts`

Cambio:

- exporta `AgentsService`.

Motivo:

- permitir que el `AgentTriggerRouter` cree runs sin duplicar lógica.

### `apps/api/src/modules/agents/agents.service.ts`

Cambio:

- `create()` ahora acepta:
  - `input`
  - `inputSummary`

Motivo:

- permitir que los runs disparados por eventos nazcan con contexto.

### `apps/api/src/modules/agents/agents.repository.ts`

Cambio:

- persistencia de:
  - `inputJson`
  - `inputSummary`

Motivo:

- aprovechar el modelo `AgentRun` ya existente en Prisma en vez de dejarlo vacío.

---

## 3. Jobs

### `apps/api/src/modules/jobs/jobs.module.ts`

Cambio:

- importa `DomainEventsModule`.

### `apps/api/src/modules/jobs/jobs.service.ts`

Cambio:

- tras `job.create`, emite `job.created`.

Trigger conectado:

- `pricing`
- `risk`

Payload emitido:

- `jobId`
- `clientOrgId`
- `title`
- `scope`
- `budgetMin`
- `budgetMax`

Resultado:

- crear un job ya encola lógica de pricing y riesgo.

---

## 4. Milestones

### `apps/api/src/modules/milestones/milestones.module.ts`

Cambio:

- importa `DomainEventsModule`.

### `apps/api/src/modules/milestones/milestones.repository.ts`

Cambio:

- agrega `getEventContext()`.

Responsabilidad:

- resolver:
  - `projectId`
  - `jobId`
  - `evidenceCount`

Motivo:

- el servicio necesita esos datos para cumplir el esquema `milestone.submitted`.

### `apps/api/src/modules/milestones/milestones.service.ts`

Cambio:

- tras `milestone.submit`, emite `milestone.submitted`.

Trigger conectado:

- `evidence-coach`

Payload emitido:

- `milestoneId`
- `projectId`
- `jobId`
- `professionalId`
- `evidenceCount`
- `checklistComplete`
- `submittedAt`

Resultado:

- al someter un milestone, se dispara validación/coaching de evidencia.

---

## 5. Disputes

### `apps/api/src/modules/disputes/disputes.module.ts`

Cambio:

- importa `DomainEventsModule`;
- exporta `DisputesRepository` y `DisputesService`.

### `apps/api/src/modules/disputes/disputes.repository.ts`

Cambio:

- agrega `getEventContext()`.

Responsabilidad:

- resolver:
  - `disputeId`
  - `jobId`
  - `projectId`
  - `raisedById`
  - `reason`

Motivo:

- cumplir el esquema `dispute.opened`.

### `apps/api/src/modules/disputes/disputes.service.ts`

Cambio:

- tras `dispute.create`, emite `dispute.opened`.

Triggers conectados:

- `dispute`
- `risk`

Payload emitido:

- `disputeId`
- `jobId`
- `projectId`
- `raisedById`
- `reasonCode`
- `reason`

Resultado:

- al abrir una disputa, se encola análisis asistido y evaluación de riesgo.

---

## 6. Wiring global

### `apps/api/src/app.module.ts`

Cambio:

- registra `DomainEventsModule` a nivel de app.

Motivo:

- dejar disponible la infraestructura de eventos dentro del API.

---

## Flujo resultante

### Job

`JobsService.create()`  
-> `DomainEventBus.emit(job.created)`  
-> `AgentTriggerRouter.route()`  
-> `AgentsService.create(pricing)`  
-> `AgentsService.create(risk)`

### Milestone

`MilestonesService.submit()`  
-> `DomainEventBus.emit(milestone.submitted)`  
-> `AgentTriggerRouter.route()`  
-> `AgentsService.create(evidence-coach)`

### Dispute

`DisputesService.create()`  
-> `DomainEventBus.emit(dispute.opened)`  
-> `AgentTriggerRouter.route()`  
-> `AgentsService.create(dispute)`  
-> `AgentsService.create(risk)`

---

## Lo que falta después de AI-1

1. executor real en `apps/worker`;
2. contratos Zod de output por agente;
3. human review gates;
4. surfaces UI para consumir recomendaciones;
5. smoke tests automáticos para validar la creación reactiva de runs.
