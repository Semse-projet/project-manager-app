# SEMSE Assistant Context Layer

Fecha: 2026-04-28
Estado: PR 2 / PR 3 parcial operativo

## Flujo canónico

```txt
AgentChatPanel
  -> /api/semse/cortex/chat
  -> /api/semse/cortex/context
  -> /v1/ai-models/prometeo/chat
  -> OperationalContextService
  -> PrometeoOrchestratorService
  -> AiModelGatewayService | respuesta sintética
  -> AiInteractionLoggerService
  -> Prisma (AiInteractionLog, OperationalContextSnapshot)
```

## Source of Truth de UI

El panel unificado usa:

```ts
selectedAgentId
activeConversationId
agentPanelMode
selectedProjectId
```

El quick switch ya no abre otro chat. Cambia el agente activo dentro del mismo panel.

## Source of Truth de backend

- contexto: `OperationalContextService`
- intención/ruta: `PrometeoOrchestratorService`
- selección de modelo: `AiModelRouterService`
- ejecución: `AiModelGatewayService`
- persistencia de observabilidad: `AiInteractionLoggerService`

`OperationalContextService` ya incluye `assistantSettings` desde `userProfile`, por lo que Prometeo recibe:

- tono
- idioma
- verbosidad
- `unifiedMode`
- `expertMode`

## Runtime local

Se alineó el runtime local con el seed demo:

- `tenant_default`
- `org_admin_001`
- `usr_admin_001`
- API base `http://127.0.0.1:4000`

Archivos clave:

- `apps/web/.env.local`
- `apps/web/app/api/semse/_server.ts`

## Modo demo / local / live

- `demo`: mock explícito
- `local`: app conectada a API + DB locales
- `live`: producción

Esto se expone en el contexto y en el footer del panel.

## Observabilidad

`AiInteractionLog` ahora guarda dos clases de interacción:

1. llamadas reales a modelo
2. respuestas sintéticas operativas
   - `prometeo-context-guard`
   - `prometeo-operational-report`

Con esto `AI Mission Control` deja de verse vacío cuando Prometeo responde sin LLM.

## Limitaciones conocidas

- el panel usa polling y refresh por interacción; falta SSE
- `systemHealth` aún no consulta Redis/worker reales
- la página `/admin/ai-mission-control` requiere login y hoy redirige a `/login` si no hay sesión
- el BFF en local evita bootstrap de `/v1/auth/token` para no generar ruido 500 innecesario
