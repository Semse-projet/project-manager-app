# Plan técnico — Persistencia Prometeo Memory (Follow-up A de #337)

**Estado:** PLAN · **Dominio:** prometeo / workspace · **Fecha:** 2026-07-19
**Origen:** Follow-up documentado en PR #337 — hoy Workspace, Copilot y Orchestrator
guardan su estado en `Map` en memoria (process-local). Se pierde en cada reinicio y
no se comparte entre instancias (Railway corre múltiples réplicas).

## Objetivo

Persistir el estado de sesión de Prometeo en PostgreSQL vía Prisma, manteniendo el
comportamiento actual (mismos contratos y FSMs) y **sin romper el arranque cuando no
hay base de datos local** (degradación grácil a memoria, igual que hace hoy
`PrismaService` para el healthcheck de Railway).

## Modelos Prisma nuevos (migración planificada)

Migración: `packages/db/prisma/migrations/20260719xxxxxx_prometeo_memory`
(solo añade tablas nuevas; **no** altera ni borra tablas existentes).

```prisma
model PrometeoWorkspaceState {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String
  userId             String
  currentScreen      String
  activeSection      String
  navigationHistory  String[] @default([])
  rightPanelMode     String
  activeMissionId    String?
  activeMissionType  String?
  activeMissionTitle String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@unique([tenantId, userId])
  @@map("prometeo_workspace_state")
}

model PrometeoCopilotSession {
  id                    String   @id @db.Uuid        // = sessionId
  tenantId              String
  userId                String
  module                String
  lastMissionSuggestion Json?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@index([tenantId])
  @@map("prometeo_copilot_session")
}

model PrometeoOrchestration {
  id               String   @id @db.Uuid            // = orchestrationId
  tenantId         String
  userId           String
  status           String
  currentStep      String
  interpretation   Json
  agentsConsulted  Json
  plan             Json
  requiresApproval Boolean
  errors           Json
  createdAt        DateTime @default(now())
  @@index([tenantId])
  @@map("prometeo_orchestration")
}
```

`tenantId`/`userId` se guardan como `String` escalar (sin FK), siguiendo tablas de
auditoría/estado existentes, para evitar fallos de FK en tests/integración.

## Capa de repositorio (nuevo)

- Interfaces `WorkspaceStateRepository`, `CopilotSessionRepository`,
  `OrchestrationRepository`.
- Implementación `Prisma*Repository` que usa `PrismaService`. Cada operación se
  envuelve: si Prisma rechaza por conexión (DB ausente), **cae a un `Map`
  in-memory** y loguea un warning. Con DB presente usa DB; sin DB se comporta
  como hoy.
- Implementación `InMemory*Repository` para tests unitarios (rápidos, sin DB).

Los servicios reciben el repo por DI; los módulos proveen el `Prisma*Repository`.

## Cambios en servicios / controladores

- `WorkspaceService`, `PrometeoCopilotService`, `OrchestrationService`: métodos
  pasan a `async` (Prisma es async). Misma lógica, FSMs y contratos.
- Controladores: `ok(rid, await this.svc.metodo(...))`. Sin cambios de rutas,
  RBAC ni envelope.

## Tests

- Se conservan los tests puros de FSM (sync).
- Los tests de servicio se reescriben para `await` inyectando el repo in-memory.
- Se añade un test que verifica que el repo Prisma degrada a memoria cuando la
  operación de DB falla.

## Gobernanza

- Migración planificada (este doc) — cumple regla AGENTS.md.
- Sin nuevos eventos (eso es el follow-up B). Se mantienen los logs de auditoría.
- Se actualizan specs `sense-workspace`, `prometeo-orchestrator`, `prometeo-copilot`
  para reflejar la persistencia.

## Fuera de alcance (siguientes follow-ups)

- C: IDs UUID estrictos en contratos Zod.
- B: registro de eventos canónicos en `EVENT_CATALOG.md` + emisión vía
  `DomainEventsService`.
