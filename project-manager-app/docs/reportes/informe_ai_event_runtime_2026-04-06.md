# Informe AI Event Runtime - 2026-04-06

## Objetivo de la sesión

Bajar la lógica de IA de SEMSE desde estrategia a implementación real en el monorepo canónico, empezando por el `Sprint AI-1`:

- definir backlog técnico por archivos;
- implementar `DomainEventBus`;
- implementar `AgentTriggerRouter`;
- conectar eventos de dominio a creación automática de `AgentRun`.

---

## Documentos creados en esta sesión

### Estrategia

- `/home/yoni/labsemse/program/strategy/SEMSE_AI_LOGIC_MODEL.md`

Contenido:

- tesis de IA para SEMSE;
- lógica por capas `Jobs / Ops / Trust / Prometeo`;
- modelo de activación por eventos;
- memoria operativa;
- límites de automatización;
- fórmula operativa del ecosistema.

### Ejecución

- `/home/yoni/labsemse/program/execution/SEMSE_AI_EXECUTION_BACKLOG.md`

Contenido:

- épicas técnicas;
- sprints sugeridos;
- rutas del monorepo;
- Definition of Done por bloque;
- orden correcto de implementación.

### Arquitectura

- `/home/yoni/labsemse/program/architecture/SEMSE_AI_EVENT_FLOW.md`

Contenido:

- flujo de eventos;
- activadores principales;
- superficies de producto;
- circuito operativo de la capa agentic.

---

## Implementación realizada en el monorepo

Repo:

- `/home/yoni/labsemse/project-manager-app`

### 1. Nuevo módulo interno de eventos

Archivos creados:

- `apps/api/src/modules/domain-events/domain-events.module.ts`
- `apps/api/src/modules/domain-events/domain-event-bus.service.ts`
- `apps/api/src/modules/domain-events/agent-trigger-router.service.ts`

Responsabilidad:

- validar eventos SEMSE con `semseEventSchema`;
- auditar emisión de evento;
- convertir triggers del evento en `AgentRun`;
- filtrar triggers internos válidos del runtime;
- reutilizar `AgentsService.create()`.

### 2. Export de `AgentsService`

Archivo modificado:

- `apps/api/src/modules/agents/agents.module.ts`

Cambio:

- `AgentsService` ahora se exporta para poder ser usado desde el router de eventos.

### 3. Extensión de creación de `AgentRun`

Archivos modificados:

- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`

Cambio:

- la creación de `AgentRun` ahora acepta:
  - `input`
  - `inputSummary`

Resultado:

- los runs disparados por eventos ya no nacen vacíos;
- cada run puede persistir contexto del evento desde el origen.

### 4. Integración de eventos en servicios de dominio

Archivos modificados:

- `apps/api/src/modules/jobs/jobs.service.ts`
- `apps/api/src/modules/milestones/milestones.service.ts`
- `apps/api/src/modules/disputes/disputes.service.ts`

Eventos conectados:

- `job.created`
- `milestone.submitted`
- `dispute.opened`

Efecto:

- `job.created` dispara `pricing` y `risk`
- `milestone.submitted` dispara `evidence-coach`
- `dispute.opened` dispara `dispute` y `risk`

### 5. Soporte de contexto para eventos

Archivos modificados:

- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/disputes/disputes.repository.ts`

Cambio:

- se añadieron helpers para resolver contexto mínimo del evento:
  - `jobId`
  - `projectId`
  - `evidenceCount`
  - `reason`
  - `raisedById`

### 6. Wiring del módulo

Archivos modificados:

- `apps/api/src/app.module.ts`
- `apps/api/src/modules/jobs/jobs.module.ts`
- `apps/api/src/modules/milestones/milestones.module.ts`
- `apps/api/src/modules/disputes/disputes.module.ts`

Cambio:

- `DomainEventsModule` quedó integrado en el API y disponible para los servicios que emiten eventos.

---

## Desglose del Sprint AI-1 por archivos

### Bloque A - Event Bus

- `apps/api/src/modules/domain-events/domain-event-bus.service.ts`
- `apps/api/src/modules/domain-events/domain-events.module.ts`

### Bloque B - Trigger Router

- `apps/api/src/modules/domain-events/agent-trigger-router.service.ts`
- `packages/schemas/src/domain-events.schema.ts`

### Bloque C - AgentRun contextual

- `apps/api/src/modules/agents/agents.service.ts`
- `apps/api/src/modules/agents/agents.repository.ts`

### Bloque D - Emisión desde dominio

- `apps/api/src/modules/jobs/jobs.service.ts`
- `apps/api/src/modules/milestones/milestones.service.ts`
- `apps/api/src/modules/disputes/disputes.service.ts`

### Bloque E - Context loaders mínimos

- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/disputes/disputes.repository.ts`

---

## Estado actual

### Completado

- estrategia de IA documentada;
- backlog técnico documentado;
- flujo arquitectónico documentado;
- event bus implementado;
- trigger router implementado;
- emisión real desde tres servicios de dominio;
- creación automática de `AgentRun` por evento.

### En verificación

- compilación de `apps/api` después del wiring inicial.

### Bloqueo de entorno verificado

- `npm run build:api` no cerró por falta de `nest` en el entorno local del workspace.
- tampoco existe `node_modules/.bin` utilizable dentro del repo canónico en esta sesión.

Conclusión:

- el bloqueo actual de build es de entorno local incompleto;
- todavía falta una validación de compilación real cuando el workspace tenga dependencias operativas.

### Actualización posterior de verificación

La fase de entorno fue reparada durante esta misma sesión:

- se recreó `node_modules/.bin` mínimo en el core;
- se corrigió permiso de ejecución de `nest`;
- se ejecutó `npm install --workspaces`;
- se compiló `@semse/agents`;
- se ejecutó `prisma generate` con red habilitada;
- se sincronizaron artefactos generados de Prisma en el core.

Estado actualizado:

- el bloqueo ya no es falta de `nest` o ausencia de bins;
- el bloqueo residual es un `Maximum call stack size exceeded` del checker de TypeScript/Nest durante el build del API.

### Pendiente siguiente paso

- cerrar build;
- corregir errores de tipos o wiring si aparecen;
- documentar resultado de verificación;
- continuar con `Sprint AI-2` si el build queda estable.

---

## Riesgos detectados

1. El repo tiene un worktree muy cargado y con mucho ruido externo, así que conviene seguir documentando cada intervención puntual.
2. `AgentRun` ya tiene más campos en Prisma que todavía no están completamente aprovechados por el runtime.
3. El worker aún simula ejecución; por ahora solo quedó resuelto el disparo del run, no el executor real.
4. La verificación automática está limitada hasta restaurar dependencias locales del repo.
5. Tras restaurar dependencias, el siguiente problema a resolver es de compilación tipada del backend, no de instalación.

---

## Próximo objetivo sugerido

Cerrar esta secuencia:

`evento -> AgentRun con contexto -> build estable -> smoke de creación automática`

Después de eso:

`executor registry -> job-planner -> pricing`
