# Observabilidad de Agent Runtime inspirada en infclaude

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Tomar ideas útiles de `infclaude` para reforzar la lógica operativa de SEMSE sin copiar su arquitectura. El patrón elegido fue la visibilidad de estado y trazabilidad de ejecución: poder seguir un flujo agentic completo desde el evento de dominio hasta los `AgentRun` y su auditoría.

## Fuente de inspiración en infclaude

Se revisaron estos materiales:

- `/home/yoni/infclaude/claurst-main/spec/01_core_entry_query.md`
- `/home/yoni/infclaude/claurst-main/spec/05_components_agents_permissions_design.md`
- `/home/yoni/infclaude/claurst-main/spec/06_services_context_state.md`
- `/home/yoni/labsemse/agents/references/infclaude/analisis_aterrizaje_infclaude_semse_2026-04-05.md`

La idea útil extraída fue esta:

`query/session state -> coordinator visibility -> execution trace -> durable context`

En SEMSE eso se aterrizó como:

`domain event -> correlationId -> AgentRun(s) -> audit timeline -> ops visibility`

## Implementación aplicada en SEMSE

Se añadieron endpoints de observabilidad operativa para seguir ejecuciones agentic por `correlationId`.

Archivos modificados:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.service.ts`

### Endpoint 1

`GET /v1/ops/agent-runtime`

Permiso:

- `ops:dashboard:read`

Filtros soportados:

- `correlationId`
- `eventType`
- `agentType`
- `status`
- `triggerType`
- `limit`

Respuesta:

- listado de `AgentRun`
- `eventType` derivado del `inputJson`
- estado, worker, intentos, review humana, error, timestamps
- `inputSummary` y `outputSummary`

### Endpoint 2

`GET /v1/ops/agent-runtime/:correlationId`

Permiso:

- `ops:dashboard:read`

Respuesta:

- `summary` del flujo
- `event` emitido
- `runs` relacionados
- `timeline` de auditoría

Esto permite ver, para un evento concreto, qué agentes se dispararon, quién los ejecutó, cómo terminaron y qué huella quedó en auditoría.

## Ajuste técnico realizado

La primera versión intentó filtrar `auditLog.afterJson` con `path` JSON en Prisma. Eso produjo error runtime:

- `A JSON path cannot be set without a scalar filter.`

Corrección aplicada:

- primero se cargan los `AgentRun` por `correlationId`
- luego se buscan `auditLog` por `entityId contains correlationId` o `entityId in runIds`
- el refinamiento final se hace en TypeScript

Con eso el trace dejó de fallar y quedó estable.

## Validación real

Se validó contra datos reales del tenant de smoke:

- `tnt_domain_worker_smoke`

Caso validado:

- `correlationId = dispute:cmnpg2i2k001nd4bs0g64haw7:opened`

Resultado del listado:

- `eventType = dispute.opened`
- dos runs completados
- agentes: `dispute` y `risk`

Resultado del trace:

- `summary.eventType = dispute.opened`
- `triggerCount = 2`
- `completed = 2`
- timeline con:
  - `domain.event.emit`
  - `agent.run.create`
  - `agent.run.claim`
  - `agent.run.heartbeat`
  - `agent.run.complete`

## Verificación

Build ejecutado:

- `npm run build:api`

Resultado:

- compila correctamente

## Lectura estratégica

Este cambio no agrega "más IA". Agrega control operativo sobre la IA que ya corre en el ecosistema.

Eso es relevante para SEMSE porque:

- baja opacidad del runtime agentic
- permite depurar disparos por evento
- hace auditable la cadena `evento -> agente -> ejecución -> resultado`
- prepara terreno para dashboard, alertas y CI de observabilidad

## Siguiente paso recomendado

Construir una superficie visual en Ops/Cortex para este runtime:

- tabla de `AgentRun`
- vista de trace por `correlationId`
- filtros por `eventType`, `status`, `agentType`
- acceso rápido a errores, retries y human review
