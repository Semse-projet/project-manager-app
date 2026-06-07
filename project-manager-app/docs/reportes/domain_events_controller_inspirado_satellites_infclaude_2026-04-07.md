# Domain Events controller inspirado en satellites-archive e infclaude

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar el hueco detectado en `domain-events`:

- dejar de ser solo infraestructura interna;
- ganar una superficie formal de inspección;
- permitir emisión controlada con contrato validado;
- mantener el patrón `bus interno + service + repository + controller`.

## Fuentes de inspiración aplicadas

### satellites-archive

Ruta:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi`

Piezas tomadas como referencia:

- `apps/api/src/modules/agent-runtime/agent-runtime.controller.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.policy.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.registry.ts`
- `packages/schemas/src/agent-runtime.view.ts`
- `docs/foundation/SCHEMA_RUNTIME_ALIGNMENT.md`

Idea extraída:

- una capacidad crítica no debe vivir solo como servicio interno;
- debe tener:
  - contracts compartidos;
  - controller formal;
  - capa de persistencia/consulta separada;
  - policy explícita cuando la semántica lo requiera.

### infclaude

Referencias:

- `/home/yoni/infclaude/claurst-main/spec/01_core_entry_query.md`
- `/home/yoni/infclaude/claurst-main/spec/07_hooks.md`

Idea extraída:

- el sistema necesita una noción observable de estado y de timeline;
- la coordinación no puede quedar invisible;
- la superficie de inspección debe permitir seguir identidad, lineage y eventos operativos.

Traducción a SEMSE:

- `domain event -> correlationId -> agent runs -> audit timeline`

## Implementación aplicada

### 1. View models compartidos

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/domain-events.view.ts`

Se añadieron:

- `DomainEventListItemView`
- `DomainEventListView`
- `DomainEventTimelineItemView`
- `DomainEventTraceView`

Y se exportaron desde:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/index.ts`

### 2. Repository de domain-events

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.repository.ts`

Responsabilidades:

- leer `domain.event.emit` desde `AuditLog`
- listar eventos por tenant
- buscar por `correlationId`
- resolver timeline relacionado
- listar `AgentRun` vinculados a un `correlationId`

### 3. Service formal

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.service.ts`

Responsabilidades:

- listar eventos emitidos
- construir trace por `correlationId`
- emitir evento validado usando `DomainEventBus`

### 4. Controller formal

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.controller.ts`

Endpoints nuevos:

- `GET /v1/domain-events`
- `GET /v1/domain-events/:correlationId`
- `POST /v1/domain-events/emit`

Permisos nuevos:

- `domain-events:read`
- `domain-events:emit`

Agregados en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/rbac.ts`

### 5. Módulo actualizado

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.module.ts`

Cambios:

- se agrega `DomainEventsController`
- se agrega `DomainEventsRepository`
- se agrega `DomainEventsService`
- se exporta `DomainEventsService` además de `DomainEventBus`

### 6. Audit enriquecido

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-event-bus.service.ts`

Cambio:

- el `afterJson` del audit ahora incluye `meta` completo del evento

Esto mejora futuros traces porque ya no dependen solo de `type`, `payload` y `triggers`.

## Resultado funcional

`domain-events` ya no es solamente:

- `bus`
- `router`

Ahora también es:

- superficie HTTP formal
- consulta por `correlationId`
- trace auditable con runs asociados
- emisión controlada y validada

## Verificación

Comando ejecutado:

- `npm run build:api`

Resultado:

- compila correctamente

## Lectura estratégica

Con este cambio, SEMSE gana una pieza importante de madurez:

- `ops` observa runtime de agentes;
- `domain-events` observa y expone el plano causal que dispara ese runtime;
- ambos quedan unidos por `correlationId`.

Eso es coherente con las dos fuentes de inspiración:

- `satellites-archive`: formalizar capacidades críticas;
- `infclaude`: hacer visible el estado coordinado y su timeline.

## Siguiente paso recomendado

Los siguientes pasos con más retorno serían:

1. agregar web proxy y vista UI para `/v1/domain-events`;
2. decidir si `POST /v1/domain-events/emit` necesita `policy.ts` adicional;
3. crear `agents.policy.ts` para reglas semánticas de retry/requeue/manage.
