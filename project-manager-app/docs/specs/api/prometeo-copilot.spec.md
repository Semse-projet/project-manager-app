---
id: "api-prometeo-copilot"
title: "Prometeo Copilot API"
domain: "prometeo"
version: "1.1"
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
  - "tests/unit/client-agent-surface-remediation.test.ts"
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
last_verified: "2026-07-25"
---

# Spec: Prometeo Copilot API

## Problem Statement

The Prometeo Copilot API and its web component subtree remain implemented, but
the authenticated layout no longer mounts that widget globally. The prior
surface exposed raw authentication errors and a quick action that reported
success without performing a real action. `AgentChatPanel` is therefore the
only global assistant until the Copilot message/action contract is made
truthful end to end.

## Scope

- In scope:
  - Retaining the backend/BFF contracts while the global widget is withdrawn.
  - URL → module/resource context detection with a confidence score.
  - Context-scoped chat with session continuity.
  - Mission suggestion + creation (delegates to the Workspace domain).
  - Quick-action execution (inline read-only vs. deferred-to-workspace).
- Out of scope:
  - Executing mutating actions inline (always deferred to the Workspace).
  - Re-exposing the global widget before authenticated messaging, truthful
    action results, user-safe errors, and regressions are complete.

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
- The global UI withdrawal does not claim that the API authentication path or
  quick-action implementation is fixed; it prevents a known-broken surface from
  making false success claims to authenticated users.

## UI Exposure Status

- `NOT_GLOBALLY_MOUNTED` as of 2026-07-25.
- `apps/web/app/(app)/layout.tsx` mounts `AgentChatPanel` exactly once and does
  not import or render `PrometeoCopilot`.
- The Copilot component, BFF helpers, schemas, and API endpoints remain in the
  tree for remediation and targeted testing.
- Re-enabling requires an authenticated end-to-end message path, real or
  explicitly deferred action semantics, translated user-safe errors, and
  regression coverage for all three.
