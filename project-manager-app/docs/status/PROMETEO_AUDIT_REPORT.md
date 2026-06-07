# PROMETEO Audit Report

Fecha: 2026-04-28
Estado: parcial sólido, no final

## Archivos encontrados

- `apps/api/src/modules/ai-models/*`
- `apps/api/src/modules/prometeo/*`
- `apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`
- `apps/web/components/ai/agent-chat-panel.tsx`
- `apps/web/components/ai/agent-panel-state.tsx`
- `apps/web/app/api/semse/cortex/*`
- `apps/web/app/(app)/admin/ai-mission-control/page.tsx`

## Problemas detectados

1. Prometeo veía agentes en UI, pero la selección del panel no afectaba la ruta real.
2. Sin `projectId`, Prometeo quedaba débil o genérico.
3. Mission Control solo veía llamadas LLM; respuestas operativas sintéticas no se contaban.
4. El runtime local web apuntaba a identidad vieja, no al seed demo operativo.
5. El contexto marcaba `demo` aunque la API estaba conectada a DB real local.
6. El BFF intentaba pedir `/v1/auth/token` en local y ensuciaba logs con 500 evitables.

## Cambios aplicados

- routing real por agente seleccionado
- guardrail sin proyecto seleccionado
- contexto operativo real por tenant/proyecto
- `AssistantSettings` reales dentro del contexto operativo
- logging de respuestas `context_only` y `report`
- `AI Mission Control` con polling de 15s
- runtime local web alineado a `tenant_default`
- modo `local` real en contexto
- bootstrap de auth token desactivado en local salvo override explícito

## Cambios pendientes

- SSE para contexto, chat, task graph y dashboards
- `systemHealth` real por heartbeat/Redis/API
- supervisor coordinado real delegando en paralelo a `field-ops` y `trust-match`
- métricas y logs cruzados por conversación/sesión

## Riesgos

- `systemHealth` todavía no prueba liveness real
- `notifications` depende mucho del seed y del usuario activo
- `AI Mission Control` sin sesión válida redirige a login
- no hay todavía consolidación completa de quick chat + catálogo + detalle en una sola pantalla administrativa

## Próximos pasos

1. SSE para Prometeo, Mission Control y graph.
2. `systemHealth` real usando Redis + worker heartbeat + endpoint health.
3. Enrutar `AssistantSettings` al copiloto por usuario y proyecto.
4. Integrar supervisor operacional real con delegaciones paralelas persistidas.
