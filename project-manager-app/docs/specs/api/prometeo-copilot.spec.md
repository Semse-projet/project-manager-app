---
id: "api-prometeo-copilot"
title: "Prometeo Copilot API"
domain: "prometeo"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
related_files:
  - "apps/api/src/modules/prometeo-copilot"
  - "packages/schemas/src/prometeo-copilot.schema.ts"
  - "apps/web/app/components/prometeo"
  - "apps/web/lib/bff/prometeo.ts"
  - "apps/web/lib/hooks/useCopilotContext.ts"
related_tests:
  - "apps/api/test/prometeo-copilot.service.test.ts"
related_endpoints:
  - "v1/prometeo/copilot/context"
  - "v1/prometeo/copilot/message"
  - "v1/prometeo/copilot/mission/create"
  - "v1/prometeo/copilot/action/execute"
related_events:
  - "copilot.message"
  - "copilot.mission.created"
  - "copilot.action.execute"
related_agents:
  - "prometeo"
last_verified: "2026-07-18"
---

# Spec: Prometeo Copilot API

## Problem Statement

The Prometeo Copilot is a context-aware floating assistant present across the
authenticated app. It detects the module/resource from the current route,
answers in-context, proposes quick actions, and — when a request warrants a
dedicated workspace — suggests and creates a SEMSE Workspace mission.

## Scope

- In scope:
  - URL → module/resource context detection with a confidence score.
  - Context-scoped chat with session continuity.
  - Mission suggestion + creation (delegates to the Workspace domain).
  - Quick-action execution (inline read-only vs. deferred-to-workspace).
- Out of scope:
  - Executing mutating actions inline (always deferred to the Workspace).

## API Surface

| Method | Path | Permission | Purpose |
| ------ | ---- | ---------- | ------- |
| POST | `/v1/prometeo/copilot/context` | `agents:run:create` | Detect context |
| POST | `/v1/prometeo/copilot/message` | `agents:run:create` | Chat in context |
| POST | `/v1/prometeo/copilot/mission/create` | `agents:run:create` | Create mission |
| POST | `/v1/prometeo/copilot/action/execute` | `agents:run:create` | Run quick action |

Contracts live in `packages/schemas/src/prometeo-copilot.schema.ts`. The Copilot
service composes `OrchestrationService` (interpretation) and `WorkspaceService`
(mission load).

## Governance

- Copilot sessions are tenant-scoped; cross-tenant session ids are ignored.
- Mutating quick actions return `requiresWorkspace = true` and a `pending`
  status instead of executing.
- Audit: message/action/mission events logged via the Nest logger.
