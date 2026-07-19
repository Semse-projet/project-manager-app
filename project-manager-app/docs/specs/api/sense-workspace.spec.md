---
id: "api-sense-workspace"
title: "SEMSE Workspace API"
domain: "workspace"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
related_files:
  - "apps/api/src/modules/workspace"
  - "packages/schemas/src/workspace.schema.ts"
  - "apps/web/app/workspace"
  - "apps/web/lib/stores/workspaceStore.ts"
  - "apps/web/lib/bff/workspace.ts"
related_tests:
  - "apps/api/test/workspace.fsm.test.ts"
  - "apps/api/test/workspace.service.test.ts"
related_endpoints:
  - "v1/workspace/context"
  - "v1/workspace/navigation"
  - "v1/workspace/mission/load"
  - "v1/workspace/mission/unload"
related_events:
  - "workspace.navigation.changed"
  - "workspace.mission.loaded"
  - "workspace.mission.unloaded"
related_agents:
  - "prometeo"
last_verified: "2026-07-18"
---

# Spec: SEMSE Workspace API

## Problem Statement

The SEMSE Workspace is a three-panel shell (left = navigation, center = active
mission, right = operational/configuration context). The backend coordinates the
ephemeral per-user UI state so navigation history, the active mission and the
right-panel mode stay consistent across reloads within a session.

## Scope

- In scope:
  - Per-user, process-local workspace state.
  - Navigation updates with bounded history + breadcrumb.
  - Mission load/unload lifecycle.
- Out of scope:
  - Persistence across processes (owned by the Prometeo Memory domain).
  - Mission content hydration (returns references; consumers hydrate).

## FSM

Mission lifecycle: `none → loaded → none` (loading replaces an active mission).
Right panel: `operational ↔ configuration`; loading a mission forces
`operational`. See `apps/api/src/modules/workspace/workspace.fsm.ts`.

## API Surface

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| GET  | `/v1/workspace/context` | authenticated | Current shell state |
| POST | `/v1/workspace/navigation` | authenticated | Change section / panel mode |
| POST | `/v1/workspace/mission/load` | authenticated | Load a mission |
| POST | `/v1/workspace/mission/unload` | authenticated | Clear the active mission |

Endpoints use `@AuthenticatedAccess` because they only ever read/mutate the
caller's own UI state. Contracts live in `packages/schemas/src/workspace.schema.ts`.

## Governance

- State is keyed by `${tenantId}:${userId}` — never shared across users/tenants.
- Navigation history is capped (20 entries) to bound memory.
- Audit: navigation/mission transitions logged via the Nest logger.
