# Reporte — IDs UUID estrictos en contratos (C)

**Fecha:** 2026-07-18
**Rama:** `devin/1784473623-strict-uuid-contracts`
**Alcance:** Reconciliar los IDs que Prisma ya define como `@db.Uuid` con los contratos Zod que aún aceptaban strings genéricos.

## Contexto

Tras persistir Prometeo Memory (PR #352), los modelos Prisma
`PrometeoWorkspaceState`, `PrometeoCopilotSession` y `PrometeoOrchestration`
declaran sus IDs como UUID. Los servicios generan esos IDs con `randomUUID()`.
Sin embargo, varios contratos Zod seguían tipando los IDs como
`z.string()` / `z.string().min(1)`, permitiendo valores no-UUID en el borde de
la API.

## Cambios

### `packages/schemas/src/workspace.schema.ts`
- `workspaceActiveMissionSchema.missionId` → `z.string().uuid()`
- `loadMissionRequestSchema.missionId` → `z.string().uuid()`
- `missionLoadResponseSchema.missionId` → `z.string().uuid()`
- `unloadMissionRequestSchema.missionId` → `z.string().uuid()`
- `missionUnloadResponseSchema.missionId` → `z.string().uuid()`

### `packages/schemas/src/prometeo-copilot.schema.ts`
- `copilotMessageRequestSchema.sessionId` → `z.string().uuid().optional()`
- `copilotMessageResponseSchema.sessionId` → `z.string().uuid()`
- `createMissionFromCopilotRequestSchema.copilotSessionId` → `z.string().uuid()`
- `missionCreationResponseSchema.missionId` → `z.string().uuid()`
- `actionExecutionResponseSchema.actionId` → `z.string().uuid()`

### `packages/schemas/src/prometeo-orchestration.schema.ts`
- `prometeoOrchestrationResponseSchema.orchestrationId` → `z.string().uuid()`
- `orchestrationStatusResponseSchema.orchestrationId` → `z.string().uuid()`
- `agentConsultationResponseSchema.consultationId` → `z.string().uuid()`

### `apps/web/app/workspace/components/MissionLoader.tsx`
El fallback `mission-${Date.now()}` ya no satisface `z.string().uuid()`. Se
sustituyó por `crypto.randomUUID()`, disponible en el runtime del navegador y en
Node ≥ 19.

## IDs deliberadamente NO convertidos

Se mantienen como strings genéricos porque representan IDs externos o de otros
dominios que no siempre son UUID:
- `copilotContextRequestSchema.additionalContext.resourceId`
- `executeCopilotActionRequestSchema.targetResource.resourceId`
- Los `requestId` de las rutas BFF (`req-…`, `fo-…`, `buildops-…`) y los `id`
  locales de mensajes de chat (claves de React), que no son campos de contrato.

## Tests

Nuevo archivo `apps/api/test/strict-uuid-contracts.test.ts`: casos de
aceptación (UUID válido) y rechazo (string no-UUID) para cada campo endurecido.

## Gates

- `pnpm build:packages` — OK
- `pnpm --filter @semse/api build` — OK
- `pnpm --filter @semse/api test:unit` — 1897/1897 OK
- `pnpm typecheck` — OK
- `pnpm lint` — 0 errores (54 warnings preexistentes)
