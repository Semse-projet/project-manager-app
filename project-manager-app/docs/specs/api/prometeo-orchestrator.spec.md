---
id: "api-prometeo-orchestrator"
title: "Prometeo Orchestrator API"
domain: "prometeo"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
related_files:
  - "apps/api/src/modules/orchestration"
  - "packages/schemas/src/prometeo-orchestration.schema.ts"
related_tests:
  - "apps/api/test/orchestration.fsm.test.ts"
  - "apps/api/test/orchestration.service.test.ts"
related_endpoints:
  - "v1/prometeo/orchestrate"
  - "v1/prometeo/agents/{agentId}/consult"
  - "v1/prometeo/orchestration/{orchestrationId}"
related_events:
  - "prometeo.orchestration.completed"
  - "prometeo.agent.explicit_access"
related_agents:
  - "prometeo"
  - "marta"
  - "felix"
  - "pulse"
  - "just"
  - "planner"
last_verified: "2026-07-18"
---

# Spec: Prometeo Orchestrator API

## Problem Statement

Prometeo needs a governed orchestration surface that interprets a natural-language
request, optionally consults specialist agents (Marta, Félix, Pulse, Just,
Planner), produces an executable plan and reports status — while keeping tenant
isolation and requiring human approval for any plan that mutates protected
resources.

## Scope

- In scope:
  - Deterministic intent interpretation + entity extraction (rule based).
  - Specialist-agent selection and consultation.
  - Plan synthesis with an explicit `requiresApproval` gate.
  - Per-tenant orchestration record lookup.
- Out of scope:
  - LLM-backed interpretation (delegated to the existing `ai-models`/`prometeo`
    RAG surface; the orchestrator stays deterministic for testability).
  - Autonomous execution of mutating steps.

## FSM

`idle → interpreting → (ambiguity_resolving?) → agent_consultation → execution → completed`
with `→ failed` reachable from every non-terminal state. See
`apps/api/src/modules/orchestration/orchestration.fsm.ts`. Illegal transitions
throw.

## API Surface

| Method | Path | Permission | Purpose |
| ------ | ---- | ---------- | ------- |
| POST | `/v1/prometeo/orchestrate` | `agents:run:create` | Interpret + plan |
| POST | `/v1/prometeo/agents/{agentId}/consult` | `agents:run:create` | Consult one agent |
| GET  | `/v1/prometeo/orchestration/{orchestrationId}` | `agents:run:create` | Status |

Request/response contracts live in
`packages/schemas/src/prometeo-orchestration.schema.ts`.

## Governance

- Tenant isolation: `getOrchestration` returns 404 across tenants.
- `requiresApproval = true` when intent is ambiguous or any plan step mutates a
  protected resource.
- Audit: material transitions are logged (`prometeo.orchestration.completed`,
  `prometeo.agent.explicit_access`). No new domain-event names were introduced
  outside `EVENT_CATALOG.md`; emission uses the Nest logger pending catalog
  registration.
