# Cortex Runtime Trace UI inspirado en infclaude

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Continuar el aterrizaje de ideas de `infclaude` hacia SEMSE, esta vez en la superficie visual de Ops/Cortex.

El principio tomado fue:

- visibilidad de estado
- trazabilidad por unidad de ejecución
- lectura rápida del flujo coordinado

En SEMSE eso se tradujo en una consola capaz de mostrar:

- corridas recientes del runtime agentic
- selección por `correlationId`
- trace operativo con timeline auditable

## Inspiración concreta desde infclaude

Referencias revisadas:

- `/home/yoni/infclaude/claurst-main/spec/01_core_entry_query.md`
- `/home/yoni/infclaude/claurst-main/spec/05_components_agents_permissions_design.md`
- `/home/yoni/infclaude/claurst-main/spec/06_services_context_state.md`

Patrón adaptado:

`session/query visibility -> execution trace -> durable state`

Aterrizaje en SEMSE:

`domain event -> correlationId -> AgentRun list -> trace -> audit timeline`

## Cambios implementados

### 1. Tipos compartidos

Archivo:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/ops.schema.ts`

Se agregaron:

- `agentRuntimeItemSchema`
- `agentRuntimeListSchema`
- `agentRuntimeTraceSchema`
- tipos `AgentRuntimeItem`, `AgentRuntimeList`, `AgentRuntimeTrace`

Además, `CortexSnapshot` ahora incluye:

- `agentRuntime`

### 2. Proxy web para Cortex

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/cortex/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/cortex/runtime/[correlationId]/route.ts`

Cambios:

- el snapshot de Cortex ahora consume `GET /v1/ops/agent-runtime?limit=12`
- se añadió un endpoint web dedicado para pedir el trace por `correlationId`
- se usa `fetchSemseDataForRequest` para preservar identidad de sesión en el trace

### 3. Cliente web

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Cambios:

- export de `AgentRuntimeTrace`
- nueva función `fetchCortexRuntimeTrace(correlationId)`

### 4. Consola Cortex

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/cortex/semse-cortex-console.tsx`

Cambios:

- carga de `agentRuntime` desde el snapshot real
- selección de `correlationId`
- fetch del trace detallado
- nueva vista `Agent Runtime`
- nueva vista `Trace`
- resumen del flujo
- timeline de auditoría

La consola ahora deja navegar de una corrida reciente al detalle completo del evento y sus acciones:

- `domain.event.emit`
- `agent.run.create`
- `agent.run.claim`
- `agent.run.heartbeat`
- `agent.run.complete`

### 5. Estilos y móvil

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/globals.css`

Se añadieron estilos para:

- lista de runtime
- tarjetas de resumen
- evento principal
- timeline
- ajuste responsive móvil

## Ajuste lateral resuelto

Archivo:

- `/home/yoni/labsemse/project-manager-app/packages/ui/src/components/EscrowTimeline.tsx`

Se corrigió una inconsistencia previa del repo:

- el componente asumía `PENDING` como `MilestoneApiStatus`
- el tipo API real ya no lo declara
- se normalizó `PENDING -> DRAFT`
- fallback de UI cambiado a `DRAFT`

Esto dejó `tsc` del workspace `@semse/web` limpio.

## Verificación ejecutada

Comandos validados:

- `npm run build --workspace @semse/schemas`
- `npm exec tsc --workspace @semse/web -- --noEmit`

Resultado:

- ambos pasan

Comando que sigue fallando:

- `npm run build --workspace @semse/web`

Resultado:

- `Bus error (core dumped)`

Lectura actual:

- no quedó evidencia de error de tipos del cambio implementado
- el bloqueo visible de `next build` parece estar en el runner/entorno de Next en esta máquina

## Impacto en el ecosistema SEMSE

Este cambio sube el nivel operativo de Cortex:

- ya no solo muestra métricas agregadas
- ahora puede inspeccionar corridas agentic reales
- conecta el plano visual con la cadena `evento -> run -> auditoría`
- prepara el terreno para alertas por trace roto, retries anómalos y human review

## Siguiente paso recomendado

Dos rutas útiles:

1. llevar esta misma vista a `/admin/ops` como tablero operativo formal;
2. agregar filtros activos por `eventType`, `status` y `agentType` sobre `agent-runtime`.
